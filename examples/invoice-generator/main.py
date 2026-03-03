import os
from datetime import datetime

def generate_invoice(client_name: str, amount: float, currency: str = "USD") -> dict:
    """Generate an invoice for a client."""
    invoice_id = f"INV-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    return {
        "invoice_id": invoice_id,
        "client_name": client_name,
        "amount": amount,
        "currency": currency,
        "tax": round(amount * 0.1, 2),
        "total": round(amount * 1.1, 2),
        "status": "generated",
        "created_at": datetime.now().isoformat(),
    }

def list_invoices(limit: int = 10) -> dict:
    """List recent invoices."""
    return {"invoices": [], "total": 0, "limit": limit}
