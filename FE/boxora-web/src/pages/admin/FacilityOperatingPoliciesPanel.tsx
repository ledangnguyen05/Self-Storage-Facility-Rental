import React, { useState, useEffect } from 'react'
import { Facility, FacilityPolicy, User } from '../../types'
import { facilityPolicyService } from '../../services/facilityPolicyService'
import { facilityService } from '../../services/facilityService'
import { userService } from '../../services/userService'
import { useLanguage } from '../../context/LanguageContext'
import { useAuth } from '../../context/AuthContext'
import { FacilityPolicyModal } from '../operations/components/FacilityPolicyModal'

interface FacilityOperatingPoliciesPanelProps {
  facilities: Facility[]
}

export const FacilityOperatingPoliciesPanel: React.FC<FacilityOperatingPoliciesPanelProps> = ({ facilities }) => {
  const { role } = useAuth()
  const { t } = useLanguage()
  const canManagePolicies = role === 'BUSINESS_MANAGER'

  const [allPolicies, setAllPolicies] = useState<FacilityPolicy[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [policyLoadError, setPolicyLoadError] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [toastIsError, setToastIsError] = useState(false)

  // Modals state
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false)
  const [editingPolicyFacility, setEditingPolicyFacility] = useState<Facility | null>(null)
  const [editingExistingPolicy, setEditingExistingPolicy] = useState<FacilityPolicy | null>(null)

  const [grantModalData, setGrantModalData] = useState<{
    facility: Facility
    policy: FacilityPolicy
    managers: User[]
    grantedManagerIds: string[]
    loading: boolean
  } | null>(null)

  const showToast = (msg: string, isError = false) => {
    setToastMessage(msg)
    setToastIsError(isError)
    setTimeout(() => setToastMessage(null), 3000)
  }

  const loadPolicies = async () => {
    setIsLoading(true)
    setPolicyLoadError(false)
    setAllPolicies([])
    try {
      const res = await facilityPolicyService.getAll({ size: 100 })
      if (Array.isArray(res)) {
        setAllPolicies(res)
      } else if (res && Array.isArray((res as any).content)) {
        setAllPolicies((res as any).content)
      } else {
        setPolicyLoadError(true)
      }
    } catch (err: any) {
      console.warn('Failed to load facility policies:', err)
      setAllPolicies([])
      setPolicyLoadError(true)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadPolicies()
  }, [])

  const handleOpenCreatePolicy = (fac?: Facility) => {
    setEditingPolicyFacility(fac || null)
    setEditingExistingPolicy(null)
    setIsPolicyModalOpen(true)
  }

  const handleOpenEditPolicy = (fac: Facility, pol: FacilityPolicy) => {
    setEditingPolicyFacility(fac)
    setEditingExistingPolicy(pol)
    setIsPolicyModalOpen(true)
  }

  const handleDeletePolicy = async (pol: FacilityPolicy) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa chính sách của cơ sở ${pol.facilityName || ''}?`)) {
      return
    }
    try {
      await facilityPolicyService.delete(pol.id)
      showToast('Đã xóa chính sách cơ sở thành công!')
      void loadPolicies()
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Không thể xóa chính sách.', true)
    }
  }

  const handlePolicySaved = (_saved: FacilityPolicy, isNew: boolean) => {
    showToast(isNew ? 'Đã ban hành chính sách mới cho cơ sở thành công!' : 'Đã cập nhật chính sách cơ sở thành công!')
    void loadPolicies()
  }

  const handleTogglePolicyActive = async (pol: FacilityPolicy) => {
    const newActive = pol.isActive === false ? true : false
    try {
      await facilityPolicyService.update(pol.id, { isActive: newActive })
      showToast(newActive ? 'Đã kích hoạt áp dụng chính sách cơ sở thành công!' : 'Đã ngừng áp dụng chính sách cơ sở.')
      void loadPolicies()
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Không thể thay đổi trạng thái chính sách.', true)
    }
  }

  const handleOpenGrantModal = async (fac: Facility, pol: FacilityPolicy) => {
    setGrantModalData({
      facility: fac,
      policy: pol,
      managers: [],
      grantedManagerIds: [],
      loading: true,
    })
    try {
      const [managersRes, grantsRes] = await Promise.all([
        userService.getAllUsers({ role: 'FACILITY_MANAGER', facilityId: fac.id }),
        facilityService.getPolicyExceptionGrants(pol.id),
      ])
      setGrantModalData({
        facility: fac,
        policy: pol,
        managers: managersRes.data || [],
        grantedManagerIds: Array.isArray(grantsRes) ? grantsRes : [],
        loading: false,
      })
    } catch (err: any) {
      showToast('Không thể tải danh sách quản lý cơ sở: ' + (err?.message || ''), true)
      setGrantModalData(null)
    }
  }

  const handleToggleGrant = async (managerId: string, currentlyGranted: boolean) => {
    if (!grantModalData) return
    try {
      await facilityService.setPolicyExceptionGrant(grantModalData.policy.id, managerId, !currentlyGranted)
      setGrantModalData((prev) => {
        if (!prev) return null
        const updatedIds = currentlyGranted
          ? prev.grantedManagerIds.filter((id) => id !== managerId)
          : [...prev.grantedManagerIds, managerId]
        return { ...prev, grantedManagerIds: updatedIds }
      })
      showToast(!currentlyGranted ? 'Đã cấp quyền sửa ngoại lệ cho Quản lý cơ sở!' : 'Đã thu hồi quyền sửa ngoại lệ!')
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Lỗi khi cập nhật quyền ngoại lệ.', true)
    }
  }

  const formatCurrency = (value?: number) => (value == null ? '—' : Number(value).toLocaleString('vi-VN'))

  return (
    <div className="space-y-5">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-24 right-8 z-50 flex items-center gap-2 px-4 py-3 bg-neutral-900 text-white rounded-lg shadow-xl border border-neutral-700 animate-in fade-in duration-200">
          <span className={`material-symbols-outlined text-[20px] ${toastIsError ? 'text-rose-400' : 'text-emerald-400'}`}>
            {toastIsError ? 'error' : 'check_circle'}
          </span>
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Main Container */}
      <div className="bg-white rounded-xl p-5 sm:p-6 shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-cyan-50 flex items-center justify-center text-cyan-600 border border-cyan-100 shrink-0">
              <span className="material-symbols-outlined text-[24px]">policy</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {t('Chính Sách Vận Hành Cơ Sở (Facility Operating Policies)')}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {t('Quản lý các quy định tiền cọc, điều kiện hủy hoàn tiền, SLA hoàn cọc và quy trình xử lý nợ quá hạn của từng cơ sở theo phân quyền.')}
              </p>
            </div>
          </div>
          {canManagePolicies && (
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => handleOpenCreatePolicy()}
                className="px-4 py-2 rounded-lg bg-cyan-700 hover:bg-cyan-800 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">add_circle</span>
                <span>{t('Tạo chính sách cơ sở mới')}</span>
              </button>
            </div>
          )}
        </div>

        {/* Policies Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4">{t('Cơ sở / Chi nhánh')}</th>
                <th className="py-3 px-3">{t('Trạng thái')}</th>
                <th className="py-3 px-3 text-center">{t('Tiền cọc & Thuê min')}</th>
                <th className="py-3 px-3 text-center">{t('Gia hạn & Báo trước')}</th>
                <th className="py-3 px-3 text-center">{t('Hủy hoàn tiền (Full / 1 phần)')}</th>
                <th className="py-3 px-3 text-center">{t('SLA Hoàn cọc')}</th>
                <th className="py-3 px-3 text-center">{t('Xử lý Nợ & Quá hạn')}</th>
                {canManagePolicies && <th className="py-3 px-4 text-center">{t('Thao tác')}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent mr-2 align-middle" />
                    Đang tải danh sách chính sách vận hành...
                  </td>
                </tr>
              ) : policyLoadError ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-rose-600">
                    {t('Không tải được chính sách đã lưu. Vui lòng thử lại.', 'Could not load saved policies. Please try again.')}
                  </td>
                </tr>
              ) : facilities.length > 0 ? (
                facilities.map((fac) => {
                  const policy = allPolicies.find((p) => p.facilityId === fac.id)
                  const hasPolicy = Boolean(policy)

                  return (
                    <tr key={fac.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 text-sm">{fac.name}</span>
                          <span className="text-[11px] text-slate-500 font-mono">
                            {fac.code || 'MÃ CHƯA CẬP NHẬT'} • {fac.address || fac.city || 'Chưa có địa chỉ'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        {hasPolicy ? (
                          policy?.isActive === false ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 text-[11px] font-bold border border-rose-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                              {t('Ngừng áp dụng')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              {t('Đang kích hoạt')}
                            </span>
                          )
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-[11px] font-bold border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                            {t('Chưa cấu hình')}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        {hasPolicy ? (
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-slate-900">
                              {policy?.depositPercentage ?? policy?.depositPercent ?? '—'}%
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {t('Tối thiểu', 'Minimum')} {policy?.minimumRentalMonths ?? '—'} {t('tháng')}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        {hasPolicy ? (
                          <div className="flex flex-col items-center">
                            <span className="font-medium text-slate-800">
                              {t('Mở trước', 'Opens')} {policy?.renewalWindowDays ?? '—'} {t('ngày')}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {t('Báo trả:', 'Move-out notice:')} {policy?.returnNoticeDays ?? '—'} {t('ngày')}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        {hasPolicy ? (
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-emerald-700">
                              100% (≥ {policy?.cancellationFullRefundHours ?? 48}h)
                            </span>
                            <span className="text-[10px] text-amber-600">
                              {policy?.cancellationPartialRefundPercent ?? '—'}% (≥ {policy?.cancellationPartialRefundHours ?? '—'}h)
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        {hasPolicy ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold text-xs border border-blue-200">
                            {policy?.depositRefundSlaDays ?? '—'} {t('ngày làm việc')}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        {hasPolicy ? (
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-rose-600">
                              {formatCurrency(policy?.dailyLateFee ?? policy?.lateFeePerDay)} đ/ngày
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {t('Ân hạn', 'Grace')} {policy?.overdueGraceDays ?? '—'}d • {t('Khóa', 'Disable')} {policy?.overdueAccessDisableDays ?? '—'}d • {t('Niêm phong', 'Seal')} {policy?.overdueSealingDays ?? '—'}d
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      {canManagePolicies && (
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            {hasPolicy && policy ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditPolicy(fac, policy)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-50 hover:bg-cyan-100 text-cyan-700 font-bold text-xs transition border border-cyan-200 cursor-pointer"
                                  title="Chỉnh sửa quy định chính sách"
                                >
                                  <span className="material-symbols-outlined text-[15px]">edit</span>
                                  <span>{t('Sửa')}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleTogglePolicyActive(policy)}
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold text-xs transition border cursor-pointer ${
                                    policy.isActive === false
                                      ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                                      : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200'
                                  }`}
                                  title={policy.isActive === false ? 'Kích hoạt chính sách này' : 'Ngừng áp dụng chính sách này'}
                                >
                                  <span className="material-symbols-outlined text-[15px]">
                                    {policy.isActive === false ? 'toggle_on' : 'toggle_off'}
                                  </span>
                                  <span>{policy.isActive === false ? t('Kích hoạt') : t('Ngừng áp dụng')}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenGrantModal(fac, policy)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs transition border border-indigo-200 cursor-pointer"
                                  title="Cấp quyền sửa ngoại lệ cho Quản lý cơ sở"
                                >
                                  <span className="material-symbols-outlined text-[15px]">key</span>
                                  <span>{t('Ngoại lệ FM')}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeletePolicy(policy)}
                                  className="inline-flex items-center p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                                  title="Xóa chính sách"
                                >
                                  <span className="material-symbols-outlined text-[16px]">delete</span>
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleOpenCreatePolicy(fac)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs transition border border-emerald-200 cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[16px]">add</span>
                                <span>{t('Tạo chính sách')}</span>
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-slate-500">
                    {t('Chưa có danh sách cơ sở.')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* FacilityPolicyModal for Create / Edit */}
      <FacilityPolicyModal
        isOpen={isPolicyModalOpen}
        onClose={() => {
          setIsPolicyModalOpen(false)
          setEditingPolicyFacility(null)
          setEditingExistingPolicy(null)
        }}
        onSuccess={handlePolicySaved}
        facility={editingPolicyFacility}
        existingPolicy={editingExistingPolicy}
        availableFacilities={facilities}
      />

      {/* FM Exception Grant Modal */}
      {grantModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 border border-indigo-100 dark:border-indigo-900 shrink-0">
                  <span className="material-symbols-outlined text-[22px]">admin_panel_settings</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {t('Cấp Quyền Sửa Ngoại Lệ Chính Sách')}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {grantModalData.facility.name} • Thẩm quyền: Business Operations Manager
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGrantModalData(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 rounded-xl text-xs text-indigo-950 dark:text-indigo-200">
              <p className="leading-relaxed">
                Theo quy chuẩn, Quản lý cơ sở (Facility Manager) chỉ xem chính sách và thực hiện nghiệp vụ. Bạn có thể cấp quyền sửa ngoại lệ để Facility Manager linh hoạt điều chỉnh quy định riêng tại cơ sở khi cần thiết.
              </p>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Danh sách Quản lý cơ sở (Facility Managers):
              </h4>
              {grantModalData.loading ? (
                <div className="py-6 text-center text-xs text-slate-500">Đang tải danh sách nhân sự...</div>
              ) : grantModalData.managers.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
                  Chưa có nhân sự vai trò Facility Manager nào được phân công tại cơ sở này.
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {grantModalData.managers.map((mgr) => {
                    const isGranted = grantModalData.grantedManagerIds.includes(mgr.id)
                    return (
                      <div
                        key={mgr.id}
                        className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50"
                      >
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {mgr.fullName || mgr.username}
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                            {mgr.email}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleToggleGrant(mgr.id, isGranted)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                            isGranted
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                              : 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            {isGranted ? 'check_circle' : 'lock'}
                          </span>
                          <span>{isGranted ? 'Đã cấp quyền' : 'Chưa cấp quyền'}</span>
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setGrantModalData(null)}
                className="px-4 py-2 rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-xs font-bold hover:bg-slate-800 transition cursor-pointer"
              >
                {t('Hoàn tất')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

