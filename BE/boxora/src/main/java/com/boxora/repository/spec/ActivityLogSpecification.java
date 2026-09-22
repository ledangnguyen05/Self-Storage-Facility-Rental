package com.boxora.repository.spec;

import com.boxora.entity.ActivityLog;
import com.boxora.entity.User;
import com.boxora.enums.ActivityAction;
import com.boxora.enums.ActivityLogStatus;
import com.boxora.enums.ActivityLogType;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

public class ActivityLogSpecification {

    private ActivityLogSpecification() {}

    public static Specification<ActivityLog> build(
            UUID userId, ActivityLogType logType, ActivityAction action, ActivityLogStatus status,
            List<ActivityAction> criticalActions, LocalDateTime fromDate, LocalDateTime toDate, String search) {

        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            // Only join to `user` when we actually need it - userId filter or search.
            Join<ActivityLog, User> userJoin = null;
            if (userId != null || (search != null && !search.isBlank())) {
                userJoin = root.join("user", JoinType.LEFT);
            }

            if (userId != null) {
                predicates.add(cb.equal(userJoin.get("id"), userId));
            }
            if (logType != null) {
                predicates.add(cb.equal(root.get("logType"), logType));
            }
            if (action != null) {
                predicates.add(cb.equal(root.get("action"), action));
            }
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            if (criticalActions != null && !criticalActions.isEmpty()) {
                predicates.add(root.get("action").in(criticalActions));
            }
            if (fromDate != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), fromDate));
            }
            if (toDate != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"), toDate));
            }
            if (search != null && !search.isBlank()) {
                String pattern = "%" + search.toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("description")), pattern),
                        cb.like(cb.lower(root.get("emailAttempted")), pattern),
                        cb.like(cb.lower(root.get("resourceType")), pattern),
                        cb.like(cb.lower(userJoin.get("email")), pattern),
                        cb.like(cb.lower(userJoin.get("fullName")), pattern),
                        cb.like(cb.lower(userJoin.get("username")), pattern)
                ));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }
}