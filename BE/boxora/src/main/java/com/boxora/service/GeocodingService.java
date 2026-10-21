package com.boxora.service;

import com.boxora.dto.request.GeocodeRequest;
import com.boxora.dto.response.GeocodeResponse;

import java.util.List;

public interface GeocodingService {
    List<GeocodeResponse> geocode(GeocodeRequest request);
}
