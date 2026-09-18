package com.boxora.repository;

import com.boxora.entity.Role;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface RoleRepository extends MongoRepository<Role, UUID>, RoleRepositoryCustom {

    Optional<Role> findByName(String name);

    boolean existsByName(String name);

    boolean existsByNameAndIdNot(String name, UUID id);
}