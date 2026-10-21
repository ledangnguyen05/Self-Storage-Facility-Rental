package com.boxora.repository;

import com.boxora.entity.StoredFile;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface StoredFileRepository extends JpaRepository<StoredFile, UUID> {

    Optional<StoredFile> findByUrlPath(String urlPath);

    List<StoredFile> findByUrlPathIn(Collection<String> urlPaths);

    /** Oldest first: candidates for the orphan clean-up. */
    List<StoredFile> findByCategoryInAndCreatedAtBeforeOrderByCreatedAtAsc(Collection<String> categories, LocalDateTime before, Pageable pageable);
}
