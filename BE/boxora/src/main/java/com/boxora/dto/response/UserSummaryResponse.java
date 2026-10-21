package com.boxora.dto.response;

import lombok.*;

import java.util.Map;

/** Account counts for the admin users screen (for the same filters as the user list). */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserSummaryResponse {

    private long total;
    private long active;
    private long inactive;

    /** Role name (ADMIN, STAFF, ...) to number of matching accounts. */
    private Map<String, Long> byRole;
}
