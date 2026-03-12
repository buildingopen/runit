# First App in 2 Minutes

This guide is the fastest way to get a first success with RunIt.

## 1) Start RunIt

```bash
docker run \
  -p 3000:3000 \
  -p 3001:3001 \
  -e NEXT_PUBLIC_API_URL=http://localhost:3001 \
  -e MASTER_ENCRYPTION_KEY="$(openssl rand -base64 32)" \
  ghcr.io/buildingopen/runit
```

Open `http://localhost:3000`.

## 2) Paste this app

```python
from runit import app

@app.action
def greet(name: str) -> dict:
    return {"message": f"Hello, {name}!"}
```

## 3) Go Live and run it

- Click **Go Live**
- Open the generated run page
- Enter your name and click **Run**

Expected result:

```json
{"message":"Hello, Federico!"}
```

## 4) Share it

Create a share link from the app page and send it to someone else.

## If something fails

- Check API health: `curl http://localhost:3001/health`
- Confirm both ports are mapped (`3000` and `3001`)
- Confirm `MASTER_ENCRYPTION_KEY` is set
