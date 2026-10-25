import React from 'react'
import { useOutletContext } from 'react-router-dom'
import { Facility } from '../../types'
import { useAuth } from '../../context/AuthContext'
import { StaffShiftRosterPanel } from './components/StaffShiftRosterPanel'

export const StaffShiftRosterPage: React.FC = () => {
  const { user } = useAuth()
  const { selectedFacility, facilities } = useOutletContext<{
    selectedFacility?: string
    facilities?: Facility[]
  }>() || {}

  const targetFacilityId = user?.facilityId || (selectedFacility !== 'ALL' ? selectedFacility : undefined)
  const targetFacilityName = facilities?.find(f => f.id === targetFacilityId)?.name || user?.facilityName || 'Cơ sở Boxora'

  return (
    <div className="w-full text-left max-w-7xl mx-auto py-2">
      <StaffShiftRosterPanel
        facilityId={targetFacilityId}
        facilityName={targetFacilityName}
        facilities={facilities}
      />
    </div>
  )
}

export default StaffShiftRosterPage
