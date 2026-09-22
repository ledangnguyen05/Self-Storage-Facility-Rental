package com.boxora.repository;

import com.boxora.entity.Permission;
import com.boxora.entity.Role;
import com.boxora.entity.RolePermission;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;

@Repository
@RequiredArgsConstructor
public class RolePermissionRepositoryCustomImpl implements RolePermissionRepositoryCustom {

    private final MongoTemplate mongoTemplate;

    @Override
    public Page<RolePermission> findAllWithFilters(
            UUID roleId,
            UUID permissionId,
            String search,
            Boolean isActive,
            Pageable pageable
    ) {
        Query query = new Query();
        List<Criteria> criteriaList = new ArrayList<>();

        if (roleId != null) {
            criteriaList.add(Criteria.where("role.$id").is(roleId));
        }

        if (permissionId != null) {
            criteriaList.add(Criteria.where("permission.$id").is(permissionId));
        }

        if (isActive != null) {
            criteriaList.add(Criteria.where("isActive").is(isActive));
        }

        if (search != null && !search.trim().isEmpty()) {
            String regex = Pattern.quote(search.trim());

            // Search in role names
            Query roleSearchQuery = new Query(Criteria.where("name").regex(regex, "i"));
            List<UUID> matchingRoleIds = mongoTemplate.find(roleSearchQuery, Role.class)
                    .stream()
                    .map(Role::getId)
                    .toList();

            // Search in permission names
            Query permSearchQuery = new Query(Criteria.where("name").regex(regex, "i"));
            List<UUID> matchingPermIds = mongoTemplate.find(permSearchQuery, Permission.class)
                    .stream()
                    .map(Permission::getId)
                    .toList();

            List<Criteria> searchOr = new ArrayList<>();
            searchOr.add(Criteria.where("description").regex(regex, "i"));

            if (!matchingRoleIds.isEmpty()) {
                searchOr.add(Criteria.where("role.$id").in(matchingRoleIds));
            }
            if (!matchingPermIds.isEmpty()) {
                searchOr.add(Criteria.where("permission.$id").in(matchingPermIds));
            }

            criteriaList.add(new Criteria().orOperator(searchOr.toArray(new Criteria[0])));
        }

        if (!criteriaList.isEmpty()) {
            query.addCriteria(new Criteria().andOperator(criteriaList.toArray(new Criteria[0])));
        }

        long total = mongoTemplate.count(query, RolePermission.class);
        query.with(pageable);
        List<RolePermission> list = mongoTemplate.find(query, RolePermission.class);

        return new PageImpl<>(list, pageable, total);
    }

    @Override
    public List<RolePermission> findAllActiveByRoleId(UUID roleId) {
        Query query = new Query(Criteria.where("role.$id").is(roleId).and("isActive").is(true));
        List<RolePermission> rolePermissions = mongoTemplate.find(query, RolePermission.class);

        return rolePermissions.stream()
                .filter(rp -> rp.getPermission() != null && Boolean.TRUE.equals(rp.getPermission().getIsActive()))
                .toList();
    }
}
