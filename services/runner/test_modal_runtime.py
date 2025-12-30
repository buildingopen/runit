"""
Test script for Modal runtime validation
"""
import base64
import io
import json
import zipfile
from pathlib import Path

import modal

# Get the deployed function
run_endpoint_cpu = modal.Function.from_name(
    "execution-layer-runtime", "run_endpoint_cpu", environment_name="main"
)


def create_test_bundle() -> bytes:
    """Create a ZIP bundle of the test FastAPI app"""
    test_app_dir = Path(__file__).parent / "test_app"

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        # Add main.py
        main_py = test_app_dir / "main.py"
        zip_file.write(main_py, "main.py")

    zip_buffer.seek(0)
    return zip_buffer.read()


def test_modal_runtime():
    """Test the Modal runtime with a simple FastAPI app"""

    print("🧪 Testing Modal Runtime Deployment\n")

    # 1. Create test bundle
    print("1️⃣  Creating test app bundle...")
    bundle_bytes = create_test_bundle()
    bundle_b64 = base64.b64encode(bundle_bytes).decode('utf-8')
    print(f"   ✅ Bundle created ({len(bundle_bytes)} bytes)\n")

    # 2. Prepare test payload
    print("2️⃣  Preparing test payload...")
    payload = {
        "run_id": "test-run-001",
        "code_bundle": bundle_b64,
        "entrypoint": "main:app",
        "endpoint": "POST /greet",
        "request_data": {
            "json": {
                "name": "Phase 2"
            }
        },
        "env": {},
        "context": {},
        "deps_hash": "test-hash",
        "project_id": "test-project",
        "deterministic": False
    }
    print("   ✅ Payload prepared\n")

    # 3. Execute on Modal
    print("3️⃣  Executing on Modal runtime...")
    print("   ⏳ Running endpoint (this may take 5-15s for cold start)...")

    try:
        result = run_endpoint_cpu.remote(payload)

        print("   ✅ Execution completed!\n")

        # 4. Validate result
        print("4️⃣  Validating result...")
        print(f"   Run ID: {result['run_id']}")
        print(f"   Status: {result['status']}")
        print(f"   HTTP Status: {result['http_status']}")
        print(f"   Duration: {result['duration_ms']}ms")
        print(f"   Base Image: {result['base_image_version']}")

        if result['status'] == 'success':
            print(f"\n   Response Body:")
            print(f"   {json.dumps(result['response_body'], indent=2)}")

            # Check expected response
            expected_message = "Hello, Phase 2! The Modal runtime works!"
            actual_message = result['response_body'].get('message', '')

            if actual_message == expected_message:
                print(f"\n   ✅ Response matches expected output!")
                print(f"\n🎉 MODAL RUNTIME TEST PASSED!")
                print(f"\n📊 Summary:")
                print(f"   - Modal app deployed: ✅")
                print(f"   - Bundle extraction: ✅")
                print(f"   - FastAPI app import: ✅")
                print(f"   - In-process execution: ✅")
                print(f"   - Response format: ✅")
                return True
            else:
                print(f"\n   ❌ Response mismatch!")
                print(f"   Expected: {expected_message}")
                print(f"   Got: {actual_message}")
                return False
        else:
            print(f"\n   ❌ Execution failed!")
            print(f"   Error Class: {result.get('error_class')}")
            print(f"   Error Message: {result.get('error_message')}")
            print(f"   Suggested Fix: {result.get('suggested_fix')}")
            if result.get('logs'):
                print(f"\n   Logs:\n{result['logs']}")
            return False

    except Exception as e:
        print(f"\n   ❌ Exception during execution:")
        print(f"   {type(e).__name__}: {e}")
        return False


if __name__ == "__main__":
    success = test_modal_runtime()
    exit(0 if success else 1)
