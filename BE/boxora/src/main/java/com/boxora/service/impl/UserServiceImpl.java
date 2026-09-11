package com.boxora.service.impl;

import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.UserCreateRequest;
import com.boxora.dto.request.UserUpdateRequest;
import com.boxora.dto.response.UserResponse;
import com.boxora.entity.Role;
import com.boxora.entity.User;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.mapper.UserMapper;
import com.boxora.repository.RoleRepository;
import com.boxora.repository.UserRepository;
import com.boxora.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class UserServiceImpl implements UserService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;


    @Override
    public UserResponse create(UserCreateRequest request) {

        if (userRepository.existsByEmail(request.getEmail())) {
            throw new AppException(ErrorCode.EMAIL_ALREADY_EXISTS);
        }
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new AppException(ErrorCode.USER_ALREADY_EXISTS);
        }

        Role role;
        if (request.getRoleId() != null) {
            role = roleRepository.findById(request.getRoleId())
                    .orElseThrow(() -> new AppException(ErrorCode.ROLE_NOT_FOUND));
        } else {
            role = roleRepository.findByName("CUSTOMER")
                    .orElseThrow(() -> new AppException(ErrorCode.ROLE_NOT_FOUND));
        }

        User user = User.builder()
                .username(request.getUsername())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .fullName(request.getFullName())
                .phone(request.getPhone())
                .role(role)
                .isActive(true)
                .build();

        User saved = userRepository.save(user);
        return userMapper.toResponse(saved);
    }


    @Override
    public UserResponse update(UUID id, UserUpdateRequest request) {

        User user = userRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        // Check username duplicate — exclude current user
        if (request.getUsername() != null
                && userRepository.existsByUsernameAndIdNot(request.getUsername(), id)) {
            throw new AppException(ErrorCode.USER_ALREADY_EXISTS);
        }

        // Update role if provided
        if (request.getRoleId() != null) {
            Role role = roleRepository.findById(request.getRoleId())
                    .orElseThrow(() -> new AppException(ErrorCode.ROLE_NOT_FOUND));
            user.setRole(role);
        }

        userMapper.updateEntityFromRequest(request, user);
        User updated = userRepository.save(user);

        return userMapper.toResponse(updated);
    }


    @Override
    public void delete(UUID id) {

        if (!userRepository.existsById(id)) {
            throw new AppException(ErrorCode.USER_NOT_FOUND);
        }

        userRepository.deleteById(id);
        log.info("User deleted successfully with id: {}", id);
    }


    @Override
    @Transactional(readOnly = true)
    public UserResponse getById(UUID id) {

        User user = userRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        return userMapper.toResponse(user);
    }


    @Override
    @Transactional(readOnly = true)
    public PageResponse<UserResponse> findAllWithFilters(
            String search,
            Boolean isActive,
            int page,
            int size,
            String sortBy,
            String sortDir
    ) {

        Sort sort = sortDir.equalsIgnoreCase("desc")
                ? Sort.by(sortBy).descending()
                : Sort.by(sortBy).ascending();

        Pageable pageable = PageRequest.of(page, size, sort);

        Page<UserResponse> result = userRepository
                .findAllWithFilters(search, isActive, pageable)
                .map(userMapper::toResponse);

        return PageResponse.from(result);
    }

    @Override
    public UserResponse toggleActive(UUID id) {

        User user = userRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        user.setIsActive(!user.getIsActive());
        User updated = userRepository.save(user);

        return userMapper.toResponse(updated);
    }
}