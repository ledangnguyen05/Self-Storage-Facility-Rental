package com.boxora.repository;

import com.boxora.entity.Permission;
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
import java.util.regex.Pattern;

@Repository
@RequiredArgsConstructor
public class PermissionRepositoryCustomImpl implements PermissionRepositoryCustom {

    private final MongoTemplate mongoTemplate;

    @Override
    public Page<Permission> findAllWithFilters(String search, Boolean isActive, Pageable pageable) {
        Query query = new Query();
        List<Criteria> criteriaList = new ArrayList<>();

        if (search != null && !search.trim().isEmpty()) {
            String regex = Pattern.quote(search.trim());
            criteriaList.add(new Criteria().orOperator(
                    Criteria.where("name").regex(regex, "i"),
                    Criteria.where("permissionGroup").regex(regex, "i"),
                    Criteria.where("description").regex(regex, "i")
            ));
        }

        if (isActive != null) {
            criteriaList.add(Criteria.where("isActive").is(isActive));
        }

        if (!criteriaList.isEmpty()) {
            query.addCriteria(new Criteria().andOperator(criteriaList.toArray(new Criteria[0])));
        }

        long total = mongoTemplate.count(query, Permission.class);
        query.with(pageable);
        List<Permission> permissions = mongoTemplate.find(query, Permission.class);

        return new PageImpl<>(permissions, pageable, total);
    }
}
