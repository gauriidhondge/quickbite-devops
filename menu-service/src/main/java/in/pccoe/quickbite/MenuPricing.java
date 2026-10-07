package in.pccoe.quickbite;

/**
 * Pricing rules for the QuickBite canteen.
 * - Lunch-rush surcharge is NOT applied (students' canteen), but
 * - a combo discount of 10% applies when 3 or more items are ordered,
 * - GST of 5% is added on the discounted subtotal.
 */
public class MenuPricing {

    public static final double COMBO_DISCOUNT = 0.10;
    public static final double GST_RATE = 0.05;

    /** Returns the final bill amount, rounded to 2 decimals. */
    public static double finalBill(double[] itemPrices) {
        if (itemPrices == null || itemPrices.length == 0) {
            throw new IllegalArgumentException("Order must contain at least one item");
        }
        double subtotal = 0;
        for (double p : itemPrices) {
            if (p < 0) {
                throw new IllegalArgumentException("Price cannot be negative");
            }
            subtotal += p;
        }
        if (itemPrices.length >= 3) {
            subtotal = subtotal * (1 - COMBO_DISCOUNT);
        }
        double total = subtotal * (1 + GST_RATE);
        return Math.round(total * 100.0) / 100.0;
    }

    public static void main(String[] args) {
        double bill = finalBill(new double[]{20, 60, 40});
        System.out.println("QuickBite menu-service OK. Sample combo bill: Rs " + bill);
    }
}
