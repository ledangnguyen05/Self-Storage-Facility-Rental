package com.boxora.controller;

import com.boxora.common.response.ApiResponse;
import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.RoleCreateRequest;
import com.boxora.dto.request.RoleUpdateRequest;
import com.boxora.dto.response.RoleResponse;
import com.boxora.service.RoleService;
import jakarta.validation.Valid;
import lombok.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("api/v1/roles")
@RequiredArgsConstructor
@Slf4j
public class RoleController {
    private final RoleService roleService;

    @GetMapping("{id}")
    public ResponseEntity<ApiResponse<RoleResponse>> getById(@PathVariable UUID id){
        log.info("Get role by id : {}",id);
        RoleResponse response=roleService.getById(id);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<RoleResponse>> create
            (@Valid @RequestBody RoleCreateRequest request){
        log.info("Creating new role : {}", request.getName());
        RoleResponse response= roleService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).
                body(ApiResponse.success("Created role successfully",response));
    }

    @PutMapping("{id}")
    public ResponseEntity<ApiResponse<RoleResponse>> update
            (@PathVariable UUID id,@Valid @RequestBody RoleUpdateRequest request){
        log.info("Updating role : {}", request.getName());
        RoleResponse response=roleService.update(id,request);
        return ResponseEntity.ok(ApiResponse.success("Updated role successfully.", response));
    }

    @DeleteMapping("{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable UUID id){
        log.info("Deleting role with id : {}",id);
        roleService.delete(id);
        return ResponseEntity.ok(ApiResponse.success("Deleted role successfully.",null));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<PageResponse<RoleResponse>>> getAll(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Boolean isActive,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir
    ){
        log.info("Get all roles - page: {}, size: {}, search: {}", page,size,search);
        PageResponse<RoleResponse> response=roleService.getAll(search,isActive,page,size,sortBy,sortDir);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

}
