package com.boxora.repository;

import com.boxora.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface UserRepositoryCustom {
    Page<User> findAllWithFilters(String search, Boolean isActive, Pageable pageable);
}
