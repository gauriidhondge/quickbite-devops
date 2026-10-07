package in.pccoe.quickbite;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class MenuPricingTest {

    @Test
    void singleItemAddsGstOnly() {
        // 60 * 1.05 = 63.00
        assertEquals(63.00, MenuPricing.finalBill(new double[]{60}));
    }

    @Test
    void comboOfThreeGetsTenPercentOff() {
        // (20 + 60 + 40) = 120 -> 108 after 10% -> 113.40 after GST
        assertEquals(113.40, MenuPricing.finalBill(new double[]{20, 60, 40}));
    }

    @Test
    void emptyOrderIsRejected() {
        assertThrows(IllegalArgumentException.class, () -> MenuPricing.finalBill(new double[]{}));
    }

    @Test
    void negativePriceIsRejected() {
        assertThrows(IllegalArgumentException.class, () -> MenuPricing.finalBill(new double[]{-5}));
    }
}
