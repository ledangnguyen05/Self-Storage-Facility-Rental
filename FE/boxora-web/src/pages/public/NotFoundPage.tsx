import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowLeft, Compass, Search } from 'lucide-react'
import { buttonVariants } from '../../components/ui/buttonVariants'
import { getPortalForRole } from '../../constants/routes'
import { useAuth } from '../../context/AuthContext'
import { Container } from './components/Section'
import { PublicLayout } from './components/PublicLayout'
import { usePageTitle } from './components/usePageTitle'

/** 404 for unknown paths. */
export const NotFoundPage: React.FC = () => {
  usePageTitle('Không tìm thấy trang')
  const location = useLocation()
  const { isAuthenticated, role } = useAuth()
  const homeHref = isAuthenticated ? getPortalForRole(role) : '/'

  return (
    <PublicLayout>
      <Container className="flex max-w-lg flex-col items-center py-20 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-surface-2 text-fg-subtle">
          <Compass size={24} strokeWidth={1.75} aria-hidden="true" />
        </span>
        <p className="mt-5 text-sm font-medium text-fg-subtle tabular-nums">Lỗi 404</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-fg">Không tìm thấy trang</h1>
        <p className="mt-3 text-sm text-fg-muted">
          Đường dẫn <span className="break-all font-mono text-fg">{location.pathname}</span> không tồn tại hoặc đã được chuyển đi.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to={homeHref} className={buttonVariants({ size: 'lg' })}>
            <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
            {isAuthenticated ? 'Về trang làm việc' : 'Về trang chủ'}
          </Link>
          <Link to="/units" className={buttonVariants({ variant: 'secondary', size: 'lg' })}>
            <Search size={16} strokeWidth={1.75} aria-hidden="true" />
            Tìm kho trống
          </Link>
        </div>
      </Container>
    </PublicLayout>
  )
}

export default NotFoundPage
