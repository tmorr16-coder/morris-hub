// Map a SimpleFIN merchant category code (MCC) to a Plaid-style spending category
// so the insights category breakdown works for SimpleFIN transactions (SimpleFIN
// doesn't send Plaid's personal_finance_category; it sends an MCC). The `primary`
// values mirror Plaid's PFC enum so they prettify the same way in the insights UI
// (e.g. FOOD_AND_DRINK → "Food And Drink").

function pfc(primary: string, detailed?: string): { primary: string; detailed: string } {
  return { primary, detailed: detailed ?? primary };
}

/**
 * Returns a { primary, detailed } category for an MCC, or null when unknown/absent.
 */
export function mccToCategory(mcc: string | null | undefined): { primary: string; detailed: string } | null {
  if (!mcc) return null;
  const n = parseInt(String(mcc), 10);
  if (!Number.isFinite(n)) return null;

  // Groceries & food stores
  if ([5411, 5422, 5451, 5462, 5499].includes(n)) return pfc("FOOD_AND_DRINK", "FOOD_AND_DRINK_GROCERIES");
  // Restaurants, bars, fast food, caterers
  if (n >= 5811 && n <= 5814) return pfc("FOOD_AND_DRINK", "FOOD_AND_DRINK_RESTAURANT");

  // Gas / fuel
  if ([5541, 5542, 5983, 5172].includes(n)) return pfc("TRANSPORTATION", "TRANSPORTATION_GAS");
  // Transit, taxi/rideshare, tolls, parking, auto services
  if ([4111, 4112, 4121, 4131, 4784, 4789, 7523, 7538, 7549, 5533].includes(n))
    return pfc("TRANSPORTATION", "TRANSPORTATION_PUBLIC_TRANSIT");

  // Airlines / flights & travel agencies
  if ((n >= 3000 && n <= 3350) || [4511, 4722, 4723].includes(n)) return pfc("TRAVEL", "TRAVEL_FLIGHTS");
  // Car rental
  if (n >= 3351 && n <= 3499) return pfc("TRAVEL", "TRAVEL_RENTAL_CARS");
  // Lodging / hotels
  if ((n >= 3500 && n <= 3999) || n === 7011) return pfc("TRAVEL", "TRAVEL_LODGING");

  // Pharmacy, doctors, dentists, hospitals, medical
  if ([5912, 5122, 5975, 5976].includes(n) || (n >= 8011 && n <= 8099)) return pfc("MEDICAL", "MEDICAL_PRIMARY_CARE");

  // Personal care / beauty / salons / gyms
  if ([5977, 7230, 7297, 7298, 7911, 7997].includes(n)) return pfc("PERSONAL_CARE", "PERSONAL_CARE");

  // Entertainment, streaming, movies, events, digital goods
  if ([7832, 7841, 7922, 7929, 7932, 7933, 7994, 7996, 7998, 7999, 5815, 5816, 5817, 5818].includes(n))
    return pfc("ENTERTAINMENT", "ENTERTAINMENT");

  // Utilities, telecom, cable/streaming providers
  if ([4812, 4814, 4816, 4899, 4900].includes(n)) return pfc("RENT_AND_UTILITIES", "RENT_AND_UTILITIES");

  // Home improvement, hardware, contractors
  if ([1520, 1711, 1731, 1740, 1750, 1761, 1771, 5200, 5211, 5231, 5251, 5261, 5271].includes(n))
    return pfc("HOME_IMPROVEMENT", "HOME_IMPROVEMENT");

  // Clothing, department stores, electronics, general retail
  if (
    (n >= 5300 && n <= 5399) ||
    (n >= 5600 && n <= 5699) ||
    [5310, 5311, 5331, 5732, 5734, 5735, 5940, 5941, 5942, 5943, 5944, 5945, 5946, 5947, 5948, 5949, 5999].includes(n)
  )
    return pfc("GENERAL_MERCHANDISE", "GENERAL_MERCHANDISE");

  // Insurance & financial services
  if ([6300].includes(n)) return pfc("GENERAL_SERVICES", "GENERAL_SERVICES_INSURANCE");
  if ([6012, 6051, 6211, 6540].includes(n)) return pfc("GENERAL_SERVICES", "GENERAL_SERVICES_FINANCIAL");

  // Education
  if (n >= 8200 && n <= 8299) return pfc("GENERAL_SERVICES", "GENERAL_SERVICES_EDUCATION");

  // Government, charity/donations, non-profit
  if ((n >= 9200 && n <= 9500) || [8398, 8641, 8651, 8661].includes(n))
    return pfc("GOVERNMENT_AND_NON_PROFIT", "GOVERNMENT_AND_NON_PROFIT");

  // ATM cash withdrawals
  if ([6010, 6011].includes(n)) return pfc("TRANSFER_OUT", "TRANSFER_OUT_WITHDRAWAL");

  // Unknown but valid MCC → a generic bucket beats "Uncategorized"
  return pfc("GENERAL_MERCHANDISE", "GENERAL_MERCHANDISE_OTHER");
}
