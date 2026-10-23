package com.boxora.service.impl;

import com.boxora.dto.request.FeeTypeCreateRequest;
import com.boxora.dto.request.FeeTypeUpdateRequest;
import com.boxora.dto.response.FeeTypeResponse;
import com.boxora.entity.FeeType;
import com.boxora.enums.ActivityAction;
import com.boxora.enums.FeeCategory;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.mapper.FeeTypeMapper;
import com.boxora.repository.FeeTypeRepository;
import com.boxora.service.ActivityLogService;
import com.boxora.service.FeeTypeService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class FeeTypeServiceImpl implements FeeTypeService {

    private final FeeTypeRepository feeTypeRepository;
    private final FeeTypeMapper feeTypeMapper;
    private final ActivityLogService activityLogService;

    @Override
    @Transactional(readOnly = true)
    public List<FeeTypeResponse> getAllFeeTypes(FeeCategory category, Boolean activeOnly) {
        log.info("Fetching fee types with category={}, activeOnly={}", category, activeOnly);
        boolean onlyActive = Boolean.TRUE.equals(activeOnly);

        List<FeeType> list;
        if (onlyActive && category != null) {
            list = feeTypeRepository.findByFeeCategoryAndIsActiveTrue(category);
        } else if (onlyActive) {
            list = feeTypeRepository.findByIsActiveTrue();
        } else {
            list = feeTypeRepository.findAll();
            if (category != null) {
                list = list.stream().filter(f -> f.getFeeCategory() == category).toList();
            }
        }

        return list.stream().map(feeTypeMapper::toResponse).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public FeeTypeResponse getFeeTypeById(UUID id) {
        FeeType feeType = feeTypeRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.FEE_TYPE_NOT_FOUND));
        return feeTypeMapper.toResponse(feeType);
    }

    @Override
    @Transactional(readOnly = true)
    public FeeTypeResponse getFeeTypeByCode(String code) {
        FeeType feeType = feeTypeRepository.findByCode(code.trim().toUpperCase())
                .orElseThrow(() -> new AppException(ErrorCode.FEE_TYPE_NOT_FOUND));
        return feeTypeMapper.toResponse(feeType);
    }

    @Override
    @Transactional
    public FeeTypeResponse createFeeType(FeeTypeCreateRequest request) {
        String code = request.getCode().trim().toUpperCase();
        log.info("Creating fee type with code={}", code);

        if (feeTypeRepository.existsByCode(code)) {
            throw new AppException(ErrorCode.FEE_TYPE_CODE_EXISTS);
        }

        if (request.getDefaultAmount() != null && request.getDefaultAmount().compareTo(BigDecimal.ZERO) < 0) {
            throw new AppException(ErrorCode.FEE_TYPE_AMOUNT_INVALID);
        }

        FeeType feeType = feeTypeMapper.toEntity(request);
        feeType.setCode(code);
        if (request.getIsActive() == null) {
            feeType.setIsActive(true);
        }
        if (request.getIsRecurring() == null) {
            feeType.setIsRecurring(false);
        }

        FeeType saved = feeTypeRepository.save(feeType);

        activityLogService.record(
                null,
                ActivityAction.FEE_CREATE,
                "FeeType",
                saved.getId(),
                String.format("Tạo mới loại phí %s (%s) - Đơn giá: %s VNĐ", saved.getName(), saved.getCode(), saved.getDefaultAmount()),
                null,
                null
        );

        return feeTypeMapper.toResponse(saved);
    }

    @Override
    @Transactional
    public FeeTypeResponse updateFeeType(UUID id, FeeTypeUpdateRequest request) {
        log.info("Updating fee type id={}", id);
        FeeType feeType = feeTypeRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.FEE_TYPE_NOT_FOUND));

        if (request.getName() != null && !request.getName().isBlank()) {
            feeType.setName(request.getName().trim());
        }
        if (request.getDescription() != null) {
            feeType.setDescription(request.getDescription().trim());
        }
        if (request.getDefaultAmount() != null) {
            if (request.getDefaultAmount().compareTo(BigDecimal.ZERO) < 0) {
                throw new AppException(ErrorCode.FEE_TYPE_AMOUNT_INVALID);
            }
            feeType.setDefaultAmount(request.getDefaultAmount());
        }
        if (request.getFeeCategory() != null) {
            feeType.setFeeCategory(request.getFeeCategory());
        }
        if (request.getIsRecurring() != null) {
            feeType.setIsRecurring(request.getIsRecurring());
        }
        if (request.getIsActive() != null) {
            feeType.setIsActive(request.getIsActive());
        }

        FeeType saved = feeTypeRepository.save(feeType);

        activityLogService.record(
                null,
                ActivityAction.FEE_UPDATE,
                "FeeType",
                saved.getId(),
                String.format("Cập nhật loại phí %s (%s)", saved.getName(), saved.getCode()),
                null,
                null
        );

        return feeTypeMapper.toResponse(saved);
    }

    @Override
    @Transactional
    public void deleteFeeType(UUID id) {
        log.info("Deactivating fee type id={}", id);
        FeeType feeType = feeTypeRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.FEE_TYPE_NOT_FOUND));

        // Soft delete bằng cách chuyển isActive sang false
        feeType.setIsActive(false);
        feeTypeRepository.save(feeType);

        activityLogService.record(
                null,
                ActivityAction.FEE_UPDATE,
                "FeeType",
                feeType.getId(),
                String.format("Vô hiệu hóa loại phí %s (%s)", feeType.getName(), feeType.getCode()),
                null,
                null
        );
    }
}
