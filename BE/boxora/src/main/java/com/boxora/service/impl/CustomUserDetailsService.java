package com.boxora.service.impl;

import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.repository.UserRepository;
import jakarta.transaction.Transactional;
import lombok.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.*;
import org.springframework.stereotype.*;
import com.boxora.entity.User;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    @Override
    @Transactional
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        User user=userRepository.findByEmail(email)
                        .orElseThrow(()->new UsernameNotFoundException("User not found with email: "+ email));
        if(!user.getIsActive()){
            throw new AppException(ErrorCode.USER_NOT_FOUND);
        }
        List<SimpleGrantedAuthority>authorities= List.of(
                new SimpleGrantedAuthority("ROLE_"+ user.getRole().getName()));

        return org.springframework.security.core.userdetails.User.builder()
                .username(user.getEmail())
                .password(user.getPassword())
                .authorities(authorities)
                .build();
    }
}
