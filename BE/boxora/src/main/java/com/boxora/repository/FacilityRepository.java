package com.boxora.repository;

import com.boxora.entity.Facility;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface FacilityRepository extends MongoRepository<Facility, UUID> {
    Optional<Facility> findByName(String name);
}
