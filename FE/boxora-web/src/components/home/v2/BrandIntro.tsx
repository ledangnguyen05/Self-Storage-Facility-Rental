import React from 'react'
import { useLanguage } from '../../../context/LanguageContext'
import { Container, Eyebrow, LineReveal, MaskImage, Reveal } from './motion'

const VALUES: { k: string; title: string; desc: string }[] = [
  {
    k: '24/7',
    title: 'Ra vào cả ngày đêm',
    desc: 'Tự khóa & mở buồng kho bằng khóa số IoT và mã PIN, bất kỳ lúc nào.',
  },
  {
    k: '18–22°C',
    title: 'Kiểm soát nhiệt ẩm',
    desc: 'Buồng A/C duy trì nhiệt độ ổn định và độ ẩm dưới 55% RH suốt ngày đêm.',
  },
  {
    k: '04',
    title: 'Cơ sở tại TP.HCM',
    desc: 'Quận 1, Quận 7, Thủ Đức và Tân Bình — chọn điểm lưu trữ thuận tiện nhất.',
  },
  {
    k: '100%',
    title: 'Hợp đồng điện tử',
    desc: 'Thanh toán qua VNPay / VietQR và ký hợp đồng điện tử ngay trên nền tảng.',
  },
]

export const BrandIntro: React.FC = () => {
  const { t } = useLanguage()
  return (
    <section
      id="about"
      className="relative bg-white py-28 text-slate-900 dark:bg-slate-950 dark:text-white sm:py-36 lg:py-44"
    >
      <Container>
        <Reveal>
          <Eyebrow index="02" label={t('Về Boxora')} />
        </Reveal>

        <div className="mt-12 grid gap-16 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-7">
            <LineReveal
              as="h2"
              className="text-[2.5rem] font-semibold leading-[1.05] tracking-[-0.03em] sm:text-6xl lg:text-[5.25rem]"
              lines={[
                t('Không gian lưu trữ'),
                t('riêng tư, an toàn'),
                <span key="c" className="text-sky-700 dark:text-cyan-300">
                  {t('và luôn sẵn sàng.')}
                </span>,
              ]}
            />
            <Reveal delay={0.15} className="mt-10 max-w-xl">
              <p className="text-lg leading-relaxed text-slate-600 dark:text-slate-300">
                {t(
                  'Buồng kho độc lập, bảo mật bằng khóa số IoT, với đủ 16 kích cỡ từ 1 m³ đến 24 m³ — bạn chỉ trả phí cho đúng không gian thực sự sử dụng.'
                )}
              </p>
            </Reveal>

            <dl className="mt-20 grid gap-x-12 gap-y-12 border-t border-slate-200 pt-12 dark:border-slate-800 sm:grid-cols-2">
              {VALUES.map((v, i) => (
                <Reveal key={v.k} delay={(i % 2) * 0.1} className={i % 2 ? 'sm:mt-12' : ''}>
                  <dt className="text-4xl font-semibold tracking-tight text-sky-700 tabular-nums dark:text-cyan-300 lg:text-5xl">
                    {v.k}
                  </dt>
                  <dd className="mt-4">
                    <p className="font-semibold">{t(v.title)}</p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                      {t(v.desc)}
                    </p>
                  </dd>
                </Reveal>
              ))}
            </dl>
          </div>

          <div className="relative lg:col-span-5 lg:pt-24">
            <MaskImage
              src="/smart-warehouse-clean.jpg"
              alt={t('Kho thông minh Boxora')}
              className="aspect-[4/5] w-full rounded-sm bg-slate-100 dark:bg-slate-800"
              parallax={50}
              from="bottom"
            />
            <MaskImage
              src="/assets/units/facility-hallway.jpg"
              alt={t('Hành lang buồng kho an ninh 24/7')}
              className="-mt-16 ml-auto hidden aspect-[4/3] w-3/5 border-8 border-white bg-slate-100 dark:border-slate-950 sm:block lg:-ml-16 lg:mr-auto"
              parallax={30}
              from="left"
              delay={0.2}
            />
          </div>
        </div>
      </Container>
    </section>
  )
}
