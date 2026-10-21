import type { TranslateContext, Translator } from './translator'

/**
 * Translates the rendered page in place, without touching React's state.
 *
 * - A text node (or a run of adjacent text nodes React renders for "Có {n} phòng") is translated only when the
 *   whole text matches the dictionary (see `translator.ts`); otherwise it stays Vietnamese.
 * - Attributes `placeholder`, `title`, `aria-label`, `alt` and `aria-description` follow the same rule.
 * - Content data is never translated: anything inside `translate="no"`, `[data-no-translate]`, `.notranslate`,
 *   editable regions, form fields, code, and the chat transcript is skipped.
 * - The Vietnamese source of every changed node is remembered, so switching back restores it exactly and a later
 *   React update (which writes fresh Vietnamese) is detected and translated again.
 */

const TEXT_NODE = 3
const COMMENT_NODE = 8

const ATTRIBUTES = ['placeholder', 'title', 'aria-label', 'alt', 'aria-description'] as const
const ATTRIBUTE_SELECTOR = ATTRIBUTES.map(name => `[${name}]`).join(',')

/** Content that is never translated, wherever it appears. */
const CONTENT_SELECTORS = [
  '[translate="no"]',
  '[data-no-translate]',
  '.notranslate',
  '[contenteditable=""]',
  '[contenteditable="true"]',
  // Boxora AI conversation bubbles (user questions and model answers); the empty state and status lines stay translatable.
  '[role="log"] [class*="max-w-[88%]"]',
]
/** Text inside these is code or user input; their labels (placeholder, aria-label) are still translated. */
const TEXT_ONLY_SKIP = ['script', 'style', 'noscript', 'code', 'pre', 'textarea']

const SKIP_TEXT_SELECTOR = [...TEXT_ONLY_SKIP, ...CONTENT_SELECTORS].join(',')
const SKIP_ATTRIBUTE_SELECTOR = CONTENT_SELECTORS.join(',')

interface Origin {
  /** Vietnamese text as React rendered it. */
  source: string
  /** What this module last wrote into the node. */
  output: string
}

const textRecords = new WeakMap<Text, Origin>()
const attributeRecords = new WeakMap<Element, Map<string, Origin>>()
let titleRecord: Origin | null = null

/** Returns the Vietnamese source of `node`: the remembered source when the node still holds our output. */
function sourceOf(node: Text): string {
  const value = node.nodeValue ?? ''
  const record = textRecords.get(node)
  if (record && value === record.output) return record.source
  textRecords.set(node, { source: value, output: value })
  return value
}

function write(node: Text, source: string, output: string) {
  if (node.nodeValue !== output) node.nodeValue = output
  textRecords.set(node, { source, output })
}

/** Controls whose text is a verb ("Từ chối" is the button "Reject", not the status "Rejected"). */
const ACTION_SELECTOR = 'button,a,summary,[role="button"],[role="menuitem"],[role="tab"],[role="link"]'

const isTextSkipped = (element: Element | null) => !element || element.closest(SKIP_TEXT_SELECTOR) !== null
const isAttributeSkipped = (element: Element) => element.closest(SKIP_ATTRIBUTE_SELECTOR) !== null
const contextOf = (element: Element): TranslateContext | undefined =>
  element.closest(ACTION_SELECTOR) !== null ? 'action' : undefined

function collectTextParents(root: Node, into: Set<Element>) {
  if (root.nodeType === TEXT_NODE) {
    if (root.parentElement) into.add(root.parentElement)
    return
  }
  if (root.nodeType !== 1) return
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.parentElement) into.add(node.parentElement)
  }
}

function collectAttributeElements(root: Node, into: Set<Element>) {
  if (!(root instanceof Element)) return
  if (root.matches(ATTRIBUTE_SELECTOR)) into.add(root)
  root.querySelectorAll(ATTRIBUTE_SELECTOR).forEach(element => into.add(element))
}

export class DomTranslator {
  private bodyObserver: MutationObserver | null = null
  private headObserver: MutationObserver | null = null

  constructor(
    private readonly translator: Translator,
    private readonly root: HTMLElement = document.body,
  ) {}

  start() {
    this.applySubtree(this.root)
    this.applyTitle()

    this.bodyObserver = new MutationObserver(records => this.onBodyMutations(records))
    this.bodyObserver.observe(this.root, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...ATTRIBUTES],
    })

    this.headObserver = new MutationObserver(() => {
      this.applyTitle()
      this.headObserver?.takeRecords()
    })
    this.headObserver.observe(document.head, { childList: true, subtree: true, characterData: true })
  }

  /** Stops observing and puts every node we changed back to its Vietnamese source. */
  stop() {
    this.bodyObserver?.disconnect()
    this.headObserver?.disconnect()
    this.bodyObserver = null
    this.headObserver = null
    this.restoreSubtree(this.root)
    this.restoreTitle()
  }

  private applySubtree(root: Node) {
    const parents = new Set<Element>()
    const attributed = new Set<Element>()
    collectTextParents(root, parents)
    collectAttributeElements(root, attributed)
    this.applyBatch(parents, attributed)
  }

  private applyBatch(parents: Set<Element>, attributed: Set<Element>) {
    parents.forEach(parent => this.applyParent(parent))
    attributed.forEach(element => this.applyAttributes(element))
  }

  private onBodyMutations(records: MutationRecord[]) {
    const parents = new Set<Element>()
    const attributed = new Set<Element>()
    for (const record of records) {
      if (record.type === 'childList') {
        if (record.target instanceof Element) parents.add(record.target)
        record.addedNodes.forEach(added => {
          collectTextParents(added, parents)
          collectAttributeElements(added, attributed)
        })
      } else if (record.type === 'characterData') {
        if (record.target.parentElement) parents.add(record.target.parentElement)
      } else if (record.target instanceof Element) {
        attributed.add(record.target)
      }
    }
    this.applyBatch(parents, attributed)
    // Drop the records our own writes just queued so they are not processed again.
    this.bodyObserver?.takeRecords()
  }

  /** Translates the text children of `parent`, treating adjacent text nodes as one phrase. */
  private applyParent(parent: Element) {
    if (isTextSkipped(parent)) return
    const context = contextOf(parent)
    let run: Text[] = []
    for (const child of Array.from(parent.childNodes)) {
      if (child.nodeType === TEXT_NODE) run.push(child as Text)
      else if (child.nodeType !== COMMENT_NODE) {
        this.applyRun(run, context)
        run = []
      }
    }
    this.applyRun(run, context)
  }

  private applyRun(run: Text[], context: TranslateContext | undefined) {
    if (run.length === 0) return
    const sources = run.map(sourceOf)

    if (run.length > 1) {
      const joined = sources.join('')
      const translated = joined.trim() ? this.translator.translate(joined, context) : null
      if (translated !== null) {
        write(run[0], sources[0], translated)
        for (let i = 1; i < run.length; i++) write(run[i], sources[i], '')
        return
      }
    }

    run.forEach((node, i) => {
      const translated = sources[i].trim() ? this.translator.translate(sources[i], context) : null
      write(node, sources[i], translated ?? sources[i])
    })
  }

  private applyAttributes(element: Element) {
    if (isAttributeSkipped(element)) return
    const context = contextOf(element)
    let records = attributeRecords.get(element)
    for (const name of ATTRIBUTES) {
      const value = element.getAttribute(name)
      if (value === null) continue
      const record = records?.get(name)
      const source = record && value === record.output ? record.source : value
      const translated = source.trim() ? this.translator.translate(source, context) : null
      const output = translated ?? source
      if (output !== value) element.setAttribute(name, output)
      if (!records) {
        records = new Map()
        attributeRecords.set(element, records)
      }
      records.set(name, { source, output })
    }
  }

  private applyTitle() {
    const current = document.title
    const source = titleRecord && current === titleRecord.output ? titleRecord.source : current
    // "Tìm kho · Boxora" and "Boxora — Thuê kho…": translate each segment between the separators.
    const output = source
      .split(/( [·—] )/)
      .map((part, index) => (index % 2 === 1 ? part : (this.translator.translate(part) ?? part)))
      .join('')
    titleRecord = { source, output }
    if (output !== current) document.title = output
  }

  private restoreSubtree(root: Node) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const record = textRecords.get(node as Text)
      if (record && node.nodeValue === record.output && record.output !== record.source) {
        node.nodeValue = record.source
      }
    }
    if (!(root instanceof Element)) return
    const elements = [root, ...Array.from(root.querySelectorAll(ATTRIBUTE_SELECTOR))]
    for (const element of elements) {
      const records = attributeRecords.get(element)
      if (!records) continue
      records.forEach((record, name) => {
        if (element.getAttribute(name) === record.output && record.output !== record.source) {
          element.setAttribute(name, record.source)
        }
      })
    }
  }

  private restoreTitle() {
    if (titleRecord && document.title === titleRecord.output && titleRecord.output !== titleRecord.source) {
      document.title = titleRecord.source
    }
    titleRecord = null
  }
}
