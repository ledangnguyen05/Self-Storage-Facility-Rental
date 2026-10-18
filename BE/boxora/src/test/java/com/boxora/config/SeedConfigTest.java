package com.boxora.config;

import com.boxora.repository.FacilityRepository;
import com.boxora.repository.RoleRepository;
import com.boxora.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.ApplicationArguments;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SeedConfigTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private RoleRepository roleRepository;

    @Mock
    private FacilityRepository facilityRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Test
    void run_skipsSeedWritesWhenUsersAlreadyExist() {
        when(userRepository.count()).thenReturn(1L);
        SeedConfig seedConfig = new SeedConfig(userRepository, roleRepository, facilityRepository, passwordEncoder);

        seedConfig.run(mock(ApplicationArguments.class));

        verify(userRepository).count();
        verifyNoMoreInteractions(userRepository);
        verifyNoInteractions(roleRepository, facilityRepository, passwordEncoder);
    }
}
