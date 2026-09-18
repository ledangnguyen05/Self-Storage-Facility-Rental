package com.boxora.repository;

import com.boxora.entity.Role;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface RoleRepositoryCustom {
    Page<Role> findAllWithFilters(String search, Boolean isActive, Pageable pageable);
}
