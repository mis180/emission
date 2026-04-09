# Testing Results and Input Values (M1 Verification)

There is a slight difference between the **RND 211.2.02.09-2004** document section numbers and the **Method 1 (M1_storage)** implementation codes in your system. This is because the system follows the unified numbering system (e.g., from *Приказ 221-Ө*).

### M1 Formula Mapping Table

| Example # | Case Description | M1 Formula Code | RND 2004 Doc Ref | Maximum Emission ($M$, g/s) | Annual Emission ($G$, t/year) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **10.1** | NPI: Benzine-catalysate | **4.2** | (5.2.1), (5.2.2) | 11.81 | 320.28 |
| **10.2** | NPI: Ai-92 (unleaded) | **4.2** | (5.2.1), (5.2.3) | 21.83 | 865.32 |
| **10.3** | NPI: A-76 (unleaded) | **4.2** | (5.2.1), (5.2.2) | 48.52 | 1483.40 |
| **10.4** | NPI: Technical Kerosene | **4.6** | (5.6.1), (5.6.2) | 0.395 | 16.93 |
| **10.5** | Solvent 646 (Components) | **4.4** | (5.4.1), (5.4.2) | 0.0115 (Acetone) | 0.1117 (Acetone) |
| **10.6** | Oil Depot: Benzine | **5.2** | (6.2.1), (6.2.2) | 86.40 | 77.504 |
| **10.7** | Gas Station: Ai-92 | **7.1** | (9.2.1), (9.2.4) | 1.60 | 5.1975 |
| **10.8** | Power Plant: Fuel Oil (Heated) | **4.6** | (5.6.1), (5.6.2) | 0.3794 | 0.2767 |

> [!NOTE]
> **Why the difference?**
> The original **RND 211.2.02.09-2004** document numbers its calculation sections as 5, 6, 8, and 9. Your **Method 1** implementation uses a "Unified" numbering scheme where these sections are shifted to 4, 5, 6, and 7 respectively to match a broader cross-methodology standard.

### Which formulas are being tested?
1.  **Formula 4.2 / 4.6 (Storage tanks):** Testing the "Big Breath" ($V_{max}$) and "Small Breath" (storage loss) logic.
2.  **Formula 4.4 (Mixtures):** Testing the component breakdown based on fractional concentration and Antoine constants.
3.  **Formula 5.2 (Depots):** Testing the climate-specific specific emission values ($U_{oz}, U_{vl}$).
4.  **Formula 7.1 (Fuel Stations):** Testing combined emissions from tank filling ($C_p$) and vehicle fueling ($C_b$).