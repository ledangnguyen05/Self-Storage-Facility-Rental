package com.boxora.repository;

import com.boxora.entity.User;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends MongoRepository<User, UUID>, UserRepositoryCustom {

    Optional<User> findByEmail(String email);

    Optional<User> findByUsername(String username);

    boolean existsByEmail(String email);

    boolean existsByUsername(String username);

    boolean existsByUsernameAndIdNot(String username, UUID id);

    boolean existsByEmailAndIdNot(String email, UUID id);

    @Query(value = "{ 'role.$id': ?0 }", exists = true)
    boolean existsByRole_Id(UUID roleId);
}

