import asyncio
from data_pipeline import poll_ovation, current_data
from visibility_score import compute_visibility_score

async def main():
    print("Fetching OVATION data...")
    await poll_ovation()
    if not current_data["ovation"]:
        print("Failed to get OVATION data.")
        return

    print("Calculating visibility score for Tromso, Norway (lat 69.64, lon 18.95)...")
    tromso = await compute_visibility_score(69.64, 18.95, current_data["ovation"])
    print(tromso)

    print("Calculating visibility score for London, UK (lat 51.5, lon -0.12)...")
    london = await compute_visibility_score(51.5, -0.12, current_data["ovation"])
    print(london)

if __name__ == "__main__":
    asyncio.run(main())
