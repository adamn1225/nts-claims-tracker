/**
 * Timezone utilities for customer filtering.
 * Provides lookup by phone area code as an alternative to address-based lookup.
 */

export type TimezoneCode = "EST" | "CST" | "MST" | "PST";

/**
 * Maps US phone area codes to their primary timezone.
 * Area codes that span timezone boundaries are mapped to the majority timezone.
 * Notable exceptions are commented inline.
 */
export const AREA_CODE_TIMEZONES: Record<string, TimezoneCode> = {
  // --- EASTERN (EST) ---
  // Connecticut
  203: "EST", 475: "EST", 860: "EST",
  // DC
  202: "EST",
  // Delaware
  302: "EST",
  // Florida (note: 850 is CST - FL panhandle)
  239: "EST", 305: "EST", 321: "EST", 352: "EST", 386: "EST",
  407: "EST", 561: "EST", 727: "EST", 754: "EST", 772: "EST",
  786: "EST", 813: "EST", 863: "EST", 904: "EST", 941: "EST", 954: "EST",
  // Georgia
  229: "EST", 404: "EST", 470: "EST", 478: "EST", 678: "EST",
  706: "EST", 762: "EST", 770: "EST", 912: "EST",
  // Indiana (majority EST, some western counties are CST)
  219: "EST", 260: "EST", 317: "EST", 463: "EST", 574: "EST", 765: "EST", 812: "EST",
  // Kentucky (eastern/central KY is EST; 270 is CST)
  502: "EST", 606: "EST", 859: "EST",
  // Maryland
  240: "EST", 301: "EST", 410: "EST", 443: "EST", 667: "EST",
  // Massachusetts
  339: "EST", 351: "EST", 413: "EST", 508: "EST", 617: "EST",
  774: "EST", 781: "EST", 857: "EST", 978: "EST",
  // Maine
  207: "EST",
  // Michigan (majority EST; 906 UP has some CST but mostly EST)
  231: "EST", 248: "EST", 269: "EST", 313: "EST", 517: "EST",
  586: "EST", 616: "EST", 734: "EST", 810: "EST", 906: "EST", 947: "EST", 989: "EST",
  // New Hampshire
  603: "EST",
  // New Jersey
  201: "EST", 551: "EST", 609: "EST", 732: "EST", 848: "EST",
  856: "EST", 862: "EST", 908: "EST", 973: "EST",
  // New York
  212: "EST", 315: "EST", 332: "EST", 347: "EST", 516: "EST",
  518: "EST", 585: "EST", 607: "EST", 631: "EST", 646: "EST",
  716: "EST", 718: "EST", 838: "EST", 845: "EST", 914: "EST",
  917: "EST", 929: "EST", 934: "EST",
  // North Carolina
  252: "EST", 336: "EST", 704: "EST", 743: "EST", 828: "EST",
  910: "EST", 919: "EST", 980: "EST", 984: "EST",
  // Ohio
  216: "EST", 220: "EST", 234: "EST", 330: "EST", 380: "EST",
  419: "EST", 440: "EST", 513: "EST", 567: "EST", 614: "EST",
  740: "EST", 937: "EST",
  // Pennsylvania
  215: "EST", 223: "EST", 267: "EST", 272: "EST", 412: "EST",
  445: "EST", 484: "EST", 570: "EST", 610: "EST", 717: "EST",
  724: "EST", 814: "EST", 835: "EST", 878: "EST",
  // Rhode Island
  401: "EST",
  // South Carolina
  803: "EST", 839: "EST", 843: "EST", 854: "EST", 864: "EST",
  // Tennessee eastern/middle (423=Chattanooga/Knoxville, 615=Nashville, 629=Nashville, 865=Knoxville)
  423: "EST", 615: "EST", 629: "EST", 865: "EST",
  // Vermont
  802: "EST",
  // Virginia
  276: "EST", 434: "EST", 540: "EST", 571: "EST", 703: "EST", 757: "EST", 804: "EST",
  // West Virginia
  304: "EST", 681: "EST",

  // --- CENTRAL (CST) ---
  // Alabama
  205: "CST", 251: "CST", 256: "CST", 334: "CST",
  // Arkansas
  479: "CST", 501: "CST", 870: "CST",
  // Florida panhandle
  850: "CST",
  // Illinois
  217: "CST", 224: "CST", 309: "CST", 312: "CST", 331: "CST",
  447: "CST", 464: "CST", 618: "CST", 630: "CST", 708: "CST",
  773: "CST", 779: "CST", 815: "CST", 847: "CST", 872: "CST",
  // Iowa
  319: "CST", 515: "CST", 563: "CST", 641: "CST", 712: "CST",
  // Kansas
  316: "CST", 620: "CST", 785: "CST", 913: "CST",
  // Kentucky western
  270: "CST", 364: "CST",
  // Louisiana
  225: "CST", 318: "CST", 337: "CST", 504: "CST", 985: "CST",
  // Minnesota
  218: "CST", 320: "CST", 507: "CST", 612: "CST", 651: "CST", 763: "CST", 952: "CST",
  // Mississippi
  228: "CST", 601: "CST", 662: "CST", 769: "CST",
  // Missouri
  314: "CST", 417: "CST", 573: "CST", 636: "CST", 660: "CST", 816: "CST",
  // Nebraska
  308: "CST", 402: "CST", 531: "CST",
  // North Dakota
  701: "CST",
  // Oklahoma
  405: "CST", 539: "CST", 580: "CST", 918: "CST",
  // South Dakota
  605: "CST",
  // Tennessee western (Memphis area)
  731: "CST", 901: "CST", 931: "CST",
  // Texas (note: 915 El Paso = MST)
  210: "CST", 214: "CST", 254: "CST", 281: "CST", 325: "CST",
  346: "CST", 361: "CST", 409: "CST", 430: "CST", 432: "CST",
  469: "CST", 512: "CST", 682: "CST", 713: "CST", 726: "CST",
  737: "CST", 806: "CST", 817: "CST", 830: "CST", 832: "CST",
  903: "CST", 936: "CST", 940: "CST", 945: "CST", 956: "CST", 972: "CST", 979: "CST",
  // Wisconsin
  262: "CST", 414: "CST", 534: "CST", 608: "CST", 715: "CST", 920: "CST",

  // --- MOUNTAIN (MST) ---
  // Arizona
  480: "MST", 520: "MST", 602: "MST", 623: "MST", 928: "MST",
  // Colorado
  303: "MST", 719: "MST", 720: "MST", 970: "MST",
  // Idaho
  208: "MST", 986: "MST",
  // Montana
  406: "MST",
  // New Mexico
  505: "MST", 575: "MST",
  // Texas El Paso
  915: "MST",
  // Utah
  385: "MST", 435: "MST", 801: "MST",
  // Wyoming
  307: "MST",

  // --- PACIFIC (PST) ---
  // Alaska
  907: "PST",
  // California
  209: "PST", 213: "PST", 279: "PST", 310: "PST", 323: "PST",
  341: "PST", 408: "PST", 415: "PST", 424: "PST", 442: "PST",
  510: "PST", 530: "PST", 559: "PST", 562: "PST", 619: "PST",
  626: "PST", 628: "PST", 650: "PST", 657: "PST", 661: "PST",
  669: "PST", 707: "PST", 714: "PST", 747: "PST", 760: "PST",
  805: "PST", 818: "PST", 820: "PST", 831: "PST", 858: "PST",
  909: "PST", 916: "PST", 925: "PST", 949: "PST", 951: "PST",
  // Hawaii
  808: "PST",
  // Nevada
  702: "PST", 725: "PST", 775: "PST",
  // Oregon
  458: "PST", 503: "PST", 541: "PST", 971: "PST",
  // Washington
  206: "PST", 253: "PST", 360: "PST", 425: "PST", 509: "PST", 564: "PST",
};

/**
 * Extracts an area code from a phone number string.
 * Handles formats like: +1 (555) 123-4567, 5551234567, 1-555-123-4567, etc.
 * Returns null if the number is too short or unrecognizable.
 */
export function getAreaCode(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  // Strip leading country code if 11 digits and starts with 1
  const normalized =
    digits.length === 11 && digits[0] === "1" ? digits.slice(1) : digits;
  if (normalized.length < 10) return null;
  return normalized.slice(0, 3);
}

/**
 * Returns the timezone for a phone number based on its area code.
 * Returns null if the area code is not recognized or the phone is invalid.
 */
export function getTimezoneByPhone(phone: string): TimezoneCode | null {
  const areaCode = getAreaCode(phone);
  if (!areaCode) return null;
  return AREA_CODE_TIMEZONES[areaCode] ?? null;
}
