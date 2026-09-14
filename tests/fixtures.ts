import { checkinWindow } from "@/lib/airlines/checkin";
import type { ComponentSnapshot, TripSnapshot } from "@/lib/milestones/engine";
import { zonedToUtc } from "@/lib/time/zones";

export function makeFlightComponent(params: {
  id: string;
  direction: "outbound" | "inbound";
  airlineCode: string;
  departsAtLocal: string;
  departsTz: string;
  status?: string;
  checkinDone?: boolean;
}): ComponentSnapshot {
  const win = checkinWindow(params);
  return {
    id: params.id,
    type: "flight",
    status: params.status ?? "confirmed",
    supplier: params.airlineCode,
    description: `טיסה ${params.direction === "outbound" ? "הלוך" : "חזור"}`,
    freeCancelUntil: null,
    supplierPaymentDue: null,
    isUpsell: false,
    clientResponse: null,
    flight: {
      direction: params.direction,
      airlineCode: params.airlineCode,
      departsAtUtc: zonedToUtc(params.departsAtLocal, params.departsTz),
      checkinOpensAt: win.opensAt,
      checkinClosesAt: win.closesAt,
      checkinDone: params.checkinDone ?? false,
    },
  };
}

export function makeTrip(overrides: Partial<TripSnapshot> = {}): TripSnapshot {
  const departureAt = zonedToUtc("2026-08-10T06:20", "Asia/Jerusalem");
  const returnAt = zonedToUtc("2026-08-17T21:40", "Europe/Athens");

  return {
    id: "trip_1",
    code: "2609-114",
    templateId: "leisure_package",
    bookedAt: zonedToUtc("2026-03-01T10:00", "Asia/Jerusalem"),
    departureAt,
    returnAt,
    eventAt: null,
    priceToClient: 12000,
    amountPaid: 3000,
    actualSupplierCost: null,
    components: [
      makeFlightComponent({
        id: "c_out",
        direction: "outbound",
        airlineCode: "A3",
        departsAtLocal: "2026-08-10T06:20",
        departsTz: "Asia/Jerusalem",
      }),
      makeFlightComponent({
        id: "c_in",
        direction: "inbound",
        airlineCode: "A3",
        departsAtLocal: "2026-08-17T21:40",
        departsTz: "Europe/Athens",
      }),
      {
        id: "c_hotel",
        type: "hotel",
        status: "requested",
        supplier: "Hotelbeds",
        description: "מלון באתונה, 7 לילות",
        freeCancelUntil: zonedToUtc("2026-07-27T23:59", "Europe/Athens"),
        supplierPaymentDue: zonedToUtc("2026-07-20T12:00", "Asia/Jerusalem"),
        isUpsell: false,
        clientResponse: null,
        flight: null,
      },
    ],
    travelers: [
      {
        id: "t_1",
        name: "דנה כהן",
        passportExpiry: zonedToUtc("2030-01-01T00:00", "Asia/Jerusalem"),
        hasPassportNumber: true,
      },
    ],
    ...overrides,
  };
}

export function byKey<T extends { key: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((i) => [i.key, i]));
}
