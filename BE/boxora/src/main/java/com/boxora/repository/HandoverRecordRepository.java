package com.boxora.repository;

import com.boxora.entity.HandoverRecord;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface HandoverRecordRepository extends MongoRepository<HandoverRecord, UUID> {
    List<HandoverRecord> findByBooking_Id(UUID bookingId);
}
