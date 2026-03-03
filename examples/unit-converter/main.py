def convert_temperature(value: float, from_unit: str, to_unit: str) -> dict:
    """Convert temperature between Celsius, Fahrenheit, and Kelvin."""
    converters = {
        ("C", "F"): lambda v: v * 9/5 + 32,
        ("F", "C"): lambda v: (v - 32) * 5/9,
        ("C", "K"): lambda v: v + 273.15,
        ("K", "C"): lambda v: v - 273.15,
        ("F", "K"): lambda v: (v - 32) * 5/9 + 273.15,
        ("K", "F"): lambda v: (v - 273.15) * 9/5 + 32,
    }
    key = (from_unit.upper(), to_unit.upper())
    if key[0] == key[1]:
        return {"result": value, "from": from_unit, "to": to_unit}
    fn = converters.get(key)
    if not fn:
        return {"error": f"Cannot convert {from_unit} to {to_unit}"}
    return {"result": round(fn(value), 2), "from": from_unit, "to": to_unit}

def convert_distance(value: float, from_unit: str, to_unit: str) -> dict:
    """Convert distance between common units."""
    to_meters = {
        "m": 1, "km": 1000, "mi": 1609.344, "ft": 0.3048, "in": 0.0254, "yd": 0.9144,
    }
    f = to_meters.get(from_unit.lower())
    t = to_meters.get(to_unit.lower())
    if not f or not t:
        return {"error": f"Unknown unit: {from_unit} or {to_unit}"}
    result = value * f / t
    return {"result": round(result, 4), "from": from_unit, "to": to_unit}
