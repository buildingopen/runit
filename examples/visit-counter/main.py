from runit import app, remember


@app.action
def greet(name: str) -> dict:
    """Greet someone and count their visits."""
    key = f"visits:{name}"
    visits = (remember(key) or 0) + 1
    remember(key, visits)
    return {
        "message": f"Hello, {name}! This is visit #{visits}.",
        "visits": visits,
    }


@app.action
def leaderboard(top_n: int = 5) -> dict:
    """Show the most frequent visitors."""
    from runit import storage

    all_keys = storage.list()
    visit_keys = [k for k in all_keys if k.startswith("visits:")]
    entries = []
    for k in visit_keys:
        name = k.split(":", 1)[1]
        count = storage.get(k)
        entries.append({"name": name, "visits": count})
    entries.sort(key=lambda e: e["visits"], reverse=True)
    return {"leaderboard": entries[:top_n]}
