const fs = require('fs');

let content = fs.readFileSync('FE/boxora-web/src/pages/staff/StaffDashboard.tsx', 'utf8').replace(/\r\n/g, '\n');

// 1. Fix fetchArrivals header
const badHeader = `    let isCurrent = true
    setBookingDetail(null)
    setBookingDetailError('')
    setBookingDetailLoading(true)
    bookingService.getById(bookingDetailId)
      .then(booking => {
        if (isCurrent) setBookingDetail(booking)
      })
      let filtered: Booking[] = []`;

const goodHeader = `  const fetchArrivals = async (
    facilityId?: string,
    timeframe?: 'current' | 'today' | 'past' | 'future' | 'all',
    fromDate?: string,
    toDate?: string
  ) => {
    try {
      const targetId = facilityId || currentTargetFacility
      const tf = timeframe !== undefined ? timeframe : selectedShiftFilter
      const from = fromDate !== undefined ? fromDate : filterFromDate
      const to = toDate !== undefined ? toDate : filterToDate

      const data = await bookingService.getUpcomingArrivals(targetId, {
        timeframe: tf?.toUpperCase(),
        fromDate: from || undefined,
        toDate: to || undefined,
      })
      let filtered: Booking[] = []`;

content = content.replace(badHeader, goodHeader);

// 2. Fix fetchOccupancy and unitMapById
const badOccupancy = `  const fetchOccupancy = async (facilityId?: string) => {
    try {
      const scopedFacilityId = facilityId ?? ((!selectedFacility || selectedFacility === 'ALL') ? undefined : selectedFacility)
      const res = await reportService.getOccupancyReport(scopedFacilityId)
      if (res) {
        setOccupancyData(res)
      }
    })
    return map
  }, [radarUnits])`;

const goodOccupancy = `  const fetchOccupancy = async (facilityId?: string) => {
    try {
      const scopedFacilityId = facilityId ?? ((!selectedFacility || selectedFacility === 'ALL') ? undefined : selectedFacility)
      const res = await reportService.getOccupancyReport(scopedFacilityId)
      if (res) {
        setOccupancyData(res)
      }
    } catch {
      // Empty on error
    }
  }

  // Lookup maps for Storage Units (by ID and by Facility+UnitCode)
  const unitMapById = useMemo(() => {
    const map = new Map<string, StorageUnit>()
    radarUnits.forEach((u) => {
      if (u.id) map.set(u.id, u)
    })
    return map
  }, [radarUnits])`;

content = content.replace(badOccupancy, goodOccupancy);

// 3. Fix handleClaimReception
const badClaimEnd = `      if (bookingCheckinDate === todayStr && !isShiftCheckedIn) {
        setReceptionAlertData({
          isOpen: true,
          message: 'Bạn chưa điểm danh vào ca làm việc hôm nay! Vui lòng điểm danh vào ca trực trước khi tiếp nhận lượt khách.',
          booking,
          canCheckInToday: !!myTodayAssignment,
        })
        return

      }
    } catch {
      setArrivals([])
    }
  }`;

const goodClaimEnd = `      if (bookingCheckinDate === todayStr && !isShiftCheckedIn) {
        setReceptionAlertData({
          isOpen: true,
          message: 'Bạn chưa điểm danh vào ca làm việc hôm nay! Vui lòng điểm danh vào ca trực trước khi tiếp nhận lượt khách.',
          booking,
          canCheckInToday: !!myTodayAssignment,
        })
        return
      }
    }

    setClaimingBookingId(booking.id)
    try {
      const updated = await bookingService.claimCheckInReception(booking.id)
      setArrivals(prev => prev.map(b => b.id === booking.id ? {
        ...b,
        assignedStaffId: updated.assignedStaffId || user?.id,
        assignedStaffName: updated.assignedStaffName || user?.fullName || 'Nhân viên quầy'
      } : b))
      setActiveBookingId(booking.id)
      setAttendanceSuccessMsg(\`Đã tiếp nhận lượt đón khách của đơn \${booking.bookingCode} thành công!\`)
      setTimeout(() => setAttendanceSuccessMsg(null), 4000)
      setTimeout(() => {
        document.getElementById('handover-workbench')?.scrollIntoView({ behavior: 'smooth' })
      }, 50)
    } catch (err: any) {
      const isShiftCheckedIn = myTodayAssignment?.status === 'CHECKED_IN' || (myTodayAssignment?.checkedInAt && !myTodayAssignment?.checkedOutAt)
      const bookingCheckinDate = booking.expectedCheckInAt ? booking.expectedCheckInAt.slice(0, 10) : booking.startDate
      const todayStr = localDateString(new Date())
      const isBookingToday = bookingCheckinDate === todayStr

      setReceptionAlertData({
        isOpen: true,
        message: err?.response?.data?.message || 'Không thể tiếp nhận khách: Bạn chỉ có thể tiếp nhận khi có ca làm việc vào ngày hẹn check-in tại cơ sở và đã điểm danh vào ca trực.',
        booking,
        canCheckInToday: isBookingToday && !isShiftCheckedIn && !!myTodayAssignment,
      })
    } finally {
      setClaimingBookingId(null)
    }
  }`;

content = content.replace(badClaimEnd, goodClaimEnd);

// 4. Remove stray </header>
content = content.replace(`            </button>
          </div>
        </div>
      </header>`, `            </button>
          </div>
        </div>
      </div>`);

// 5. Fix </section> closing metric cards
content = content.replace(`              className="bg-blue-600 h-full rounded-full transition-all" 
              style={{ width: \`\${occupancyRate}%\` }}
            ></div>
          </div>
        </div>

      </div>`, `              className="bg-blue-600 h-full rounded-full transition-all" 
              style={{ width: \`\${occupancyRate}%\` }}
            ></div>
          </div>
        </div>
      </section>`);

// 6. Fix closing of isWalkinOpen modal
content = content.replace(`                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                  >
                    Cấp Thẻ Tham Quan
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Status Filter Tabs */}`, `                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                  >
                    Cấp Thẻ Tham Quan
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

        {/* Status Filter Tabs */}`);

fs.writeFileSync('FE/boxora-web/src/pages/staff/StaffDashboard.tsx', content, 'utf8');
console.log('Fixed StaffDashboard.tsx');

