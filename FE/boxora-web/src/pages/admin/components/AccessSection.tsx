import { useState } from 'react'
import { Link } from 'react-router-dom'
import { History, ShieldCheck, UserPlus, Users } from 'lucide-react'
import { Button, PageHeader, TabPanel, Tabs, buttonVariants } from '@/components/ui'
import { usePageTitle } from '@/pages/public/components/usePageTitle'
import { LogsTab } from './LogsTab'
import { RolesTab } from './RolesTab'
import { UsersTab } from './UsersTab'

export type AccessTab = 'users' | 'roles' | 'logs'

const TAB_TITLES: Record<AccessTab, string> = {
  users: 'Người dùng',
  roles: 'Phân quyền',
  logs: 'Nhật ký kiểm toán',
}

export interface AccessSectionProps {
  tab: AccessTab
  onTabChange: (tab: AccessTab) => void
}

/** Accounts, role permissions and the audit log. Each tab loads its own data only while it is open. */
export function AccessSection({ tab, onTabChange }: AccessSectionProps) {
  const [createOpen, setCreateOpen] = useState(false)
  usePageTitle(TAB_TITLES[tab])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Phân quyền và người dùng"
        description="Quản lý tài khoản, ma trận phân quyền theo vai trò và tra cứu nhật ký kiểm toán hệ thống."
        actions={
          <>
            <Link to="/portal/tickets" className={buttonVariants({ variant: 'secondary' })}>
              Xem sự cố
            </Link>
            {tab === 'users' ? (
              <Button leftIcon={UserPlus} onClick={() => setCreateOpen(true)}>
                Tạo tài khoản
              </Button>
            ) : null}
          </>
        }
      >
        <Tabs
          id="access"
          aria-label="Quản trị hệ thống"
          value={tab}
          onValueChange={onTabChange}
          items={[
            { value: 'users', label: 'Người dùng', icon: Users },
            { value: 'roles', label: 'Phân quyền', icon: ShieldCheck },
            { value: 'logs', label: 'Nhật ký kiểm toán', icon: History },
          ]}
        />
      </PageHeader>

      <TabPanel tabsId="access" value={tab}>
        {tab === 'users' ? <UsersTab createOpen={createOpen} onCreateOpenChange={setCreateOpen} /> : null}
        {tab === 'roles' ? <RolesTab /> : null}
        {tab === 'logs' ? <LogsTab /> : null}
      </TabPanel>
    </div>
  )
}
