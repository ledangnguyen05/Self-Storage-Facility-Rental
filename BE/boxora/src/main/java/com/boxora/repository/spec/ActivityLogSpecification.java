package com.boxora.repository.spec;

import com.boxora.entity.ActivityLog;
import com.boxora.entity.Facility;
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
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

public class ActivityLogSpecification {

    private ActivityLogSpecification() {}

    public static Specification<ActivityLog> build(
            UUID userId, ActivityLogType logType, ActivityAction action, ActivityLogStatus status,
            List<ActivityAction> criticalActions, LocalDateTime fromDate, LocalDateTime toDate, String search) {
        return build(userId, null, logType, action, status, criticalActions, null, null, fromDate, toDate, search);
    }

    public static Specification<ActivityLog> build(
            UUID userId, UUID facilityId, ActivityLogType logType, ActivityAction action, ActivityLogStatus status,
            List<ActivityAction> criticalActions, String resourceType, UUID resourceId,
            LocalDateTime fromDate, LocalDateTime toDate, String search) {
        return build(userId, facilityId, logType, action, null, status, criticalActions, resourceType, resourceId,
                fromDate, toDate, search);
    }

    /**
     * @param actions restricts the log to any of these actions (a business area, see ActivityDomain); null / empty = no restriction
     * @param resourceType one resource type, or several separated by commas (case-insensitive)
     */
    public static Specification<ActivityLog> build(
            UUID userId, UUID facilityId, ActivityLogType logType, ActivityAction action, List<ActivityAction> actions,
            ActivityLogStatus status, List<ActivityAction> criticalActions, String resourceType, UUID resourceId,
            LocalDateTime fromDate, LocalDateTime toDate, String search) {

        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            // Only join to `user` when we actually need it - userId filter or search.
            Join<ActivityLog, User> userJoin = null;
            if (userId != null || (search != null && !search.isBlank())) {
                userJoin = root.join("user", JoinType.LEFT);
            }

            // Only join to `facility` when facilityId is provided or search is present.
            Join<ActivityLog, Facility> facilityJoin = null;
            if (facilityId != null || (search != null && !search.isBlank())) {
                facilityJoin = root.join("facility", JoinType.LEFT);
            }

            if (userId != null) {
                predicates.add(cb.equal(userJoin.get("id"), userId));
            }
            if (facilityId != null) {
                predicates.add(cb.equal(facilityJoin.get("id"), facilityId));
            }
            if (logType != null) {
                predicates.add(cb.equal(root.get("logType"), logType));
            }
            if (action != null) {
                predicates.add(cb.equal(root.get("action"), action));
            }
            if (actions != null && !actions.isEmpty()) {
                predicates.add(root.get("action").in(actions));
            }
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            if (criticalActions != null && !criticalActions.isEmpty()) {
                predicates.add(root.get("action").in(criticalActions));
            }
            if (resourceType != null && !resourceType.isBlank()) {
                List<String> types = Arrays.stream(resourceType.split(","))
                        .map(String::trim)
                        .filter(t -> !t.isEmpty())
                        .map(String::toLowerCase)
                        .toList();
                if (!types.isEmpty()) {
                    predicates.add(cb.lower(root.<String>get("resourceType")).in(types));
                }
            }
            if (resourceId != null) {
                predicates.add(cb.equal(root.get("resourceId"), resourceId));
            }
            if (fromDate != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), fromDate));
            }
            if (toDate != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"), toDate));
            }
            if (search != null && !search.isBlank()) {
                String pattern = "%" + search.toLowerCase() + "%";
                List<Predicate> searchPredicates = new ArrayList<>(List.of(
                        cb.like(cb.lower(root.get("description")), pattern),
                        cb.like(cb.lower(root.get("emailAttempted")), pattern),
                        cb.like(cb.lower(root.get("resourceType")), pattern),
                        cb.like(cb.lower(userJoin.get("email")), pattern),
                        cb.like(cb.lower(userJoin.get("fullName")), pattern),
                        cb.like(cb.lower(userJoin.get("username")), pattern)
                ));
                if (facilityJoin != null) {
                    searchPredicates.add(cb.like(cb.lower(facilityJoin.get("name")), pattern));
                    searchPredicates.add(cb.like(cb.lower(facilityJoin.get("code")), pattern));
                }
                predicates.add(cb.or(searchPredicates.toArray(new Predicate[0])));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }
}