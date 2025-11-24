action_statuses

| id | inv_action_id | status_id |
| -- | ------------- | --------- |
| 8  | 13            | 2         |
| 1  | 1             | 2         |
| 2  | 1             | 5         |
| 4  | 9             | 3         |
| 5  | 5             | 1         |
| 6  | 5             | 5         |
| 7  | 14            | 3         |
| 9  | 6             | 7         |
| 10 | 2             | 2         |
| 11 | 2             | 5         |
| 12 | 6             | 2         |

categories

| id | name           |
| -- | -------------- |
| 2  | Labeling       |
| 1  | Misc           |
| 3  | Strand         |
| 4  | Conduit        |
| 6  | Splice Closure |
| 5  | Ped/HH         |
| 7  | Splitter       |
| 8  | Safety         |
| 9  | Hardware       |
| 10 | Fiber          |

clients

| id | name        | address | created_at                 | updated_at                 |
| -- | ----------- | ------- | -------------------------- | -------------------------- |
| 1  | Test Client | null    | 2025-10-04 04:35:14.372999 | 2025-10-04 04:35:14.372999 |

config

| key             | value                                       |
| --------------- | ------------------------------------------- |
| inventory_sort  | {"column":"it.name","direction":"DESC"}     |
| areaColors       | [[1,"#624dfe"],[2,"#ff9500"],[3,"#d100ca"]] |
| last_tilson_sn  | 0004                                        |
| sloc            | null                                        |
| schema_version  | 8                                           |
| currentTilsonSN | 19                                          |
| receiptNumber   | 42                                          |

crews

| id | name      | market_id | created_at                 | updated_at                 |
| -- | --------- | --------- | -------------------------- | -------------------------- |
| 1  | Test Crew | 1         | 2025-10-04 05:09:19.385248 | 2025-10-04 05:09:19.385248 |
| 2  | Crew 2    | 1         | 2025-10-10 02:21:36.842965 | 2025-10-10 02:21:36.842965 |
| 3  | Crew 424  | 1         | 2025-10-10 02:40:05.01846  | 2025-10-11 03:41:05.412    |

areas

| id | name       | sloc_id | created_at                 | updated_at                |
| -- | ---------- | ------- | -------------------------- | ------------------------- |
| 3  | Test area 2 | 1       | 2025-10-10 01:03:14.00681  | 2025-10-10 01:03:14.00681 |
| 1  | Test area 1 | 1       | 2025-10-04 05:09:46.310702 | 2025-10-10 01:40:42.542   |


inv_action_types

| id | name                        | loc_type_id | description                                        |
| -- | --------------------------- | ----------- | -------------------------------------------------- |
| 2  | Remove                      | 1           | Material removed from inventory.                   |
| 3  | Return Material As Reserved | 2           | Material returned to storage location.             |
| 1  | Adjust                      | 1           | Material quantity adjusted due to inventory, etc.  |
| 5  | Inspect                     | 1           | Material inspected and made Available.             |
| 4  | Assign DFN                  | 1           | DFN assigned to material.                          |
| 6  | Issue                       | 1           | Material issued to crew.                           |
| 7  | Reserve                     | 1           | Material reserved for specific crew.               |
| 9  | Field Install               | 2           | Material is installed.                             |
| 8  | Assign DFN                  | 2           | DFN assigned to material.                          |
| 10 | Unreserve                   | 1           | Reserved material is made Available.               |
| 12 | Move                        | 1           | Material moved between storage locations.          |
| 13 | Reject                      | 1           | Reject material.                                   |
| 11 | Allocate                    | null        | Allocate inventory quantities of serialized items. |
| 14 | Return Material             | 2           | Material returned as Available.                    |


inventory

| id | location_id | assigned_crew_id | dfn_id | item_type_id | mfgrsn | tilsonsn | quantity | status_id | sloc_id | created_at                 | updated_at                 |
| -- | ----------- | ---------------- | ------ | ------------ | ------ | -------- | -------- | --------- | ------- | -------------------------- | -------------------------- |
| 26 | 2           | null             | null   | 4            | null   | null     | 222      | 6         | 1       | 2025-10-15 03:50:05.027594 | 2025-10-15 03:50:05.027594 |
| 25 | 8           | null             | null   | 5            | null   | null     | 14       | 6         | 1       | 2025-10-15 03:50:04.301199 | 2025-10-15 03:50:04.301199 |
| 7  | 5           | null             | null   | 2            | 2 of 2 | null     | 10000    | 2         | 1       | 2025-10-07 01:48:52.917314 | 2025-10-07 01:48:52.917314 |
| 4  | 6           | 1                | 1      | 2            | null   | null     | 2000     | 3         | 1       | 2025-10-07 01:24:13.987045 | 2025-10-07 01:24:13.987045 |
| 38 | 6           | 1                | 3      | 4            | null   | null     | 21       | 3         | 1       | 2025-10-16 13:59:07.641377 | 2025-10-16 13:59:07.641377 |
| 39 | 6           | 1                | 3      | 5            | null   | null     | 22       | 3         | 1       | 2025-10-16 13:59:07.673833 | 2025-10-16 13:59:07.673833 |
| 36 | 5           | null             | null   | 5            | null   | null     | 0        | 2         | 1       | 2025-10-16 13:58:52.402549 | 2025-10-16 13:58:52.402549 |
| 34 | 3           | 1                | 3      | 1            | null   | null     | 1        | 4         | 1       | 2025-10-16 12:23:59.342102 | 2025-10-16 12:23:59.342102 |
| 19 | 5           | null             | null   | 3            | null   | null     | 46       | 2         | 1       | 2025-10-14 21:51:26.985822 | 2025-10-14 21:51:26.985822 |
| 33 | 6           | 1                | 3      | 3            | null   | null     | 3        | 3         | 1       | 2025-10-15 22:10:41.370837 | 2025-10-15 22:10:41.370837 |
| 27 | 6           | 1                | 1      | 1            | 1 of 2 | null     | 70       | 3         | 1       | 2025-10-15 04:06:27.044995 | 2025-10-15 04:06:27.044995 |
| 41 | 6           | 2                | 3      | 1            | 1 of 2 | null     | 2        | 3         | 1       | 2025-10-16 16:20:37.318851 | 2025-10-16 16:20:37.318851 |
| 1  | 7           | null             | null   | 1            | 1 of 2 | null     | 37       | 6         | 1       | 2025-10-07 00:19:46.568304 | 2025-10-07 00:19:46.568304 |
| 37 | 8           | null             | null   | 4            | null   | null     | 1        | 6         | 1       | 2025-10-16 13:58:52.995929 | 2025-10-16 13:58:52.995929 |
| 32 | 1           | null             | null   | 2            | 12345  | null     | 10000    | 2         | 1       | 2025-10-15 04:30:18.167703 | 2025-10-15 04:30:18.167703 |
| 6  | 3           | 1                | 1      | 2            | 1 of 2 | null     | 10000    | 4         | 1       | 2025-10-07 01:48:52.503067 | 2025-10-07 01:48:52.503067 |
| 5  | 5           | null             | null   | 2            | null   | null     | 4000     | 2         | 1       | 2025-10-07 01:40:31.487915 | 2025-10-07 01:40:31.487915 |


inventory_providers

| id | name   |
| -- | ------ |
| 1  | Client |
| 2  | ITG    |


inventory_types

| id | name       |
| -- | ---------- |
| 1  | Serialized |
| 2  | Bulk       |


item_types

| id | inventory_type_id | name                 | manufacturer   | part_number | unit_of_measure_id | units_per_package | description           | provider_id | low_units_quantity | category_id | image_path | meta                   | market_id | created_at                 | updated_at                 |
| -- | ----------------- | -------------------- | -------------- | ----------- | ------------------ | ----------------- | --------------------- | ----------- | ------------------ | ----------- | ---------- | ---------------------- | --------- | -------------------------- | -------------------------- |
| 1  | 2                 | Test Bulk Item       | Acme, Inc.     | 123ABC      | 1                  | 1                 | Test description      | 2           | 12                 | 6           | "xNONE"    | "NONE"                 | 1         | 2025-10-04 05:22:27.856652 | 2025-10-04 05:22:27.856652 |
| 2  | 1                 | Test Serialized Item | Reel Deal Inc. | Reel123     | 2                  | 10000             | Test reel description | 1           | 10000              | 1           | null       | enforceSequentialEntry | 1         | 2025-10-04 05:23:59.559405 | 2025-10-04 05:23:59.559405 |
| 3  | 2                 | Test bulk item 2     | null           | null        | 1                  | 1                 | null                  | 2           | null               | 1           | null       | null                   | 1         | 2025-10-10 02:32:17.917119 | 2025-10-10 02:32:17.917119 |
| 5  | 2                 | 444                  | null           | null        | 1                  | 1                 | null                  | 1           | null               | null        | null       | null                   | 1         | 2025-10-10 02:38:36.214213 | 2025-10-10 02:38:36.214213 |
| 4  | 2                 | test 333             | null           | null        | 1                  | 1                 | null                  | 2           | null               | 1           | null       | null                   | 1         | 2025-10-10 02:37:36.145188 | 2025-10-10 02:39:06.126    |


location_types

| id | name     |
| -- | -------- |
| 1  | Storage  |
| 2  | Field    |
| 4  | Incoming |
| 5  | Install  |
| 3  | Outgoing |


locations

| id | name                  | loc_type_id | is_system_required |
| -- | --------------------- | ----------- | ------------------ |
| 5  | SLOC                  | 1           | 0                  |
| 6  | With Crew             | 2           | 0                  |
| 3  | Field Installed       | 5           | 1                  |
| 1  | Return to Vendor      | 3           | 0                  |
| 4  | Return to Client      | 3           | 0                  |
| 7  | Remove from Inventory | 3           | 0                  |
| 8  | Scrap                 | 3           | 0                  |
| 2  | Material Delivery     | 4           | 1                  |


markets

| id | name        | client_id | created_at                 | updated_at                 |
| -- | ----------- | --------- | -------------------------- | -------------------------- |
| 1  | Test Market | 1         | 2025-10-04 04:35:41.736021 | 2025-10-04 04:35:41.736021 |


qty_allocations

Success. No rows returned


slocs

| id | name      | address | market_id | created_at                 | updated_at                 |
| -- | --------- | ------- | --------- | -------------------------- | -------------------------- |
| 1  | Test SLOC | null    | 1         | 2025-10-04 04:36:09.553809 | 2025-10-04 04:36:09.553809 |


statuses

| id | name      |
| -- | --------- |
| 2  | Available |
| 1  | Received  |
| 3  | Issued    |
| 5  | Rejected  |
| 6  | Removed   |
| 4  | Installed |
| 7  | Reserved  |


transaction_types

| id | name                |
| -- | ------------------- |
| 1  | Receive             |
| 2  | Inspect             |
| 3  | Reserve             |
| 4  | Reject              |
| 7  | Assign DFN          |
| 5  | Move                |
| 8  | Issue               |
| 10 | Remove              |
| 6  | Unreserve           |
| 13 | Return as Available |
| 12 | Return as Reserved  |
| 9  | Adjust              |
| 11 | Install             |


transactions

| id | inventory_id | transaction_type     | action          | client      | market      | sloc      | item_type_name       | inventory_type_name | manufacturer   | part_number | description           | unit_of_measure | units_per_package | provider_name | category_name  | mfgrsn | tilsonsn | from_location_name | from_location_type | to_location_name | to_location_type | assigned_crew_name | dfn_name   | status_name | old_status_name | quantity | old_quantity | user_name                                                                                                      | date_time                  | session_id                      | notes                                                            | ip_address    | user_agent                                                                                                      | before_state                                                                               | after_state                                                                                                                                  
| 1  | 13           | INVENTORY_MANAGEMENT | UPDATE          | Test Client | Test Market | Test SLOC | Test Bulk Item       | Bulk                | Acme, Inc.     | 123ABC      | Test description      | Each            | 1                 | ITG           | Splice Closure | null   | null     | null               | null               | null             | null             | null               | Test DFN   | Issued      | null            | 4        | 52           | system                                                                                                         | 2025-10-08 22:04:39.077795 | session_1759961005148_p4bk1vc8b | Updated fields: action: issue, transaction_type: issue           | 76.129.37.211 | Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 | {"quantity":52,"status":"Available","location":6,"dfn":1,"crew":null}                      | {"quantity":4,"status":"Issued","location":6,"dfn":1,"crew":1}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2  | 14           | INVENTORY_MANAGEMENT | UPDATE          | Test Client | Test Market | Test SLOC | Test Bulk Item       | Bulk                | Acme, Inc.     | 123ABC      | Test description      | Each            | 1                 | ITG           | Splice Closure | null   | null     | null               | null               | null             | null             | null               | Test DFN   | Issued      | null            | 6        | 48           | system                                                                                                         | 2025-10-08 22:05:07.848259 | session_1759961005148_p4bk1vc8b | Updated fields: action: issue, transaction_type: issue           | 76.129.37.211 | Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 | {"quantity":48,"status":"Available","location":6,"dfn":1,"crew":null}                      | {"quantity":6,"status":"Issued","location":6,"dfn":1,"crew":1}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 3  | 1            | INVENTORY_MANAGEMENT | QUANTITY_ADJUST | Test Client | Test Market | Test SLOC | Test Bulk Item       | Bulk                | Acme, Inc.     | 123ABC      | Test description      | Each            | 1                 | ITG           | Splice Closure | 1 of 2 | null     | null               | null               | null             | null             | null               | null       | Available   | null            | 40       | 42           | system                                                                                                         | 2025-10-09 02:19:56.253166 | session_1759976334973_cofpcha1h | Partial issue: 2 units issued to crew                            | 76.129.37.211 | Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 | null                                                                                       | null                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |


units_of_measure

| id | name |
| -- | ---- |
| 1  | Each |
| 2  | Feet |

