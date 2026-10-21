package com.boxora.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class FloorLabelsTest {

    @Test
    @DisplayName("Mixed spellings of a floor all become 'Tầng N'")
    void normalisesFloorSpellings() {
        for (String raw : new String[]{"Floor 1", "floor 1", "FLOOR1", "Tầng 1", "tầng 1", "Tang 1", "tang 01", "Tầng 1", "F1", "Level 1", "Lầu 1", " 1 "}) {
            assertThat(FloorLabels.normalize(raw)).as(raw).isEqualTo("Tầng 1");
        }
        assertThat(FloorLabels.normalize("Floor 12")).isEqualTo("Tầng 12");
    }

    @Test
    @DisplayName("Basements and the ground floor get their own labels")
    void basementAndGround() {
        assertThat(FloorLabels.normalize("B1")).isEqualTo("Hầm 1");
        assertThat(FloorLabels.normalize("Basement 2")).isEqualTo("Hầm 2");
        assertThat(FloorLabels.normalize("Hầm 1")).isEqualTo("Hầm 1");
        assertThat(FloorLabels.normalize("Ground floor")).isEqualTo("Tầng trệt");
        assertThat(FloorLabels.normalize("Tầng trệt")).isEqualTo("Tầng trệt");
    }

    @Test
    @DisplayName("Unknown names are kept (whitespace tidied) and blank input has no floor")
    void unknownNamesAreKept() {
        assertThat(FloorLabels.normalize("  Gác   lửng ")).isEqualTo("Gác lửng");
        assertThat(FloorLabels.normalize("")).isNull();
        assertThat(FloorLabels.normalize("   ")).isNull();
        assertThat(FloorLabels.normalize(null)).isNull();
        assertThat(FloorLabels.key(null)).isEmpty();
    }

    @Test
    @DisplayName("Two labels are the same floor exactly when they normalise to the same key")
    void sameFloorIgnoresSpelling() {
        assertThat(FloorLabels.sameFloor("Floor 1", "Tầng 1")).isTrue();
        assertThat(FloorLabels.sameFloor("Tang 2", "tầng 2")).isTrue();
        assertThat(FloorLabels.sameFloor("Floor 1", "Tầng 2")).isFalse();
        assertThat(FloorLabels.sameFloor(null, null)).isFalse();
        assertThat(FloorLabels.sameFloor("Hầm 1", "Tầng 1")).isFalse();
    }
}
