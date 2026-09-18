package com.boxora.repository;

import com.boxora.entity.RefreshToken;
import com.boxora.entity.User;
import com.boxora.enums.TokenType;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Repository;

@Repository
@RequiredArgsConstructor
public class RefreshTokenRepositoryCustomImpl implements RefreshTokenRepositoryCustom {

    private final MongoTemplate mongoTemplate;

    @Override
    public void revokeAllUserTokensByType(User user, TokenType type) {
        Query query = new Query(Criteria.where("user.$id").is(user.getId()).and("type").is(type));
        Update update = new Update().set("revoked", true);
        mongoTemplate.updateMulti(query, update, RefreshToken.class);
    }

    @Override
    public void revokeAllUserTokens(User user) {
        Query query = new Query(Criteria.where("user.$id").is(user.getId()));
        Update update = new Update().set("revoked", true);
        mongoTemplate.updateMulti(query, update, RefreshToken.class);
    }
}
