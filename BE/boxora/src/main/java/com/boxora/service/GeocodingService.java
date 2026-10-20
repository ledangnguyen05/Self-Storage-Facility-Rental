package com.boxora.service;

import com.boxora.dto.request.GeocodeRequest;
import com.boxora.dto.response.GeocodeResponse;

public interface GeocodingService {
    GeocodeResponse geocode(GeocodeRequest request);
}
