package com.boxora.repository;

import com.boxora.entity.Permission;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface PermissionRepositoryCustom {
    Page<Permission> findAllWithFilters(String search, Boolean isActive, Pageable pageable);
}
