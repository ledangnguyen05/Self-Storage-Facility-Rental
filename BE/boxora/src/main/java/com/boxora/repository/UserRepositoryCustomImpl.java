package com.boxora.repository;

import com.boxora.entity.User;
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
public class UserRepositoryCustomImpl implements UserRepositoryCustom {

    private final MongoTemplate mongoTemplate;

    @Override
    public Page<User> findAllWithFilters(String search, Boolean isActive, Pageable pageable) {
        Query query = new Query();
        List<Criteria> criteriaList = new ArrayList<>();

        if (search != null && !search.trim().isEmpty()) {
            String regex = Pattern.quote(search.trim());
            criteriaList.add(new Criteria().orOperator(
                    Criteria.where("username").regex(regex, "i"),
                    Criteria.where("email").regex(regex, "i"),
                    Criteria.where("fullName").regex(regex, "i")
            ));
        }

        if (isActive != null) {
            criteriaList.add(Criteria.where("isActive").is(isActive));
        }

        if (!criteriaList.isEmpty()) {
            query.addCriteria(new Criteria().andOperator(criteriaList.toArray(new Criteria[0])));
        }

        long total = mongoTemplate.count(query, User.class);
        query.with(pageable);
        List<User> users = mongoTemplate.find(query, User.class);

        return new PageImpl<>(users, pageable, total);
    }
}
