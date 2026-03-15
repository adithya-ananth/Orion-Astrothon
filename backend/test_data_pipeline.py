import asyncio
from data_pipeline import poll_solar_wind, poll_ovation, current_data

async def main():
    print("Testing initial solar wind pull...")
    await poll_solar_wind()
    print("Result:", {k: v for k, v in current_data.items() if k != "ovation"})

    print("\nTesting initial OVATION pull...")
    await poll_ovation()
    if current_data["ovation"]:
        print("OVATION data populated.")
    else:
        print("Failed to populate OVATION data.")

if __name__ == "__main__":
    asyncio.run(main())
