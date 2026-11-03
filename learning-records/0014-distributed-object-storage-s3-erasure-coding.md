# 0014: Distributed Object & Blob Storage: S3 Architecture, Chunking & Erasure Coding

## Context & Motivation
Storing petabytes of unstructured binary data (images, videos, machine learning models, database backups) requires fundamentally different primitives than block or file storage. Naive solutions (e.g., storing Base64 blobs in relational databases or writing to container-local file directories) cause catastrophic buffer pool exhaustion, backup failures, and data loss during container restarts. High-scale systems employ S3-compatible Object Storage that decouples metadata from append-only chunk storage and replaces expensive 3× replication with Reed-Solomon Erasure Coding.

## Key Learnings & Architectural Decisions
1. **The Three Storage Paradigms:**
   - **Block Storage (EBS, SAN):** Raw disk blocks attached to a single host. Ultra-low latency, but cannot scale horizontally across thousands of nodes or provide a shared web API.
   - **File Storage (NFS, EFS):** Hierarchical POSIX tree with folder hierarchies. POSIX locks and directory traversal metadata create severe bottlenecks under high concurrent client load.
   - **Object Storage (S3, GCS, MinIO, Ceph):** Flat namespace of discrete, immutable blobs accessed via HTTP REST (`GET /bucket/key`, `PUT /bucket/key`). Highly scalable to exabytes with zero file lock contention.

2. **Decoupled Metadata vs. Data Planes:**
   - **Metadata Plane (Control Plane):** Manages object attributes (bucket, key, size, content-type, etag, ACLs, and array of chunk IDs). Requires ultra-low latency (<5ms) and high QPS, backed by distributed key-value stores (DynamoDB, Spanner, CockroachDB).
   - **Data Plane (Payload Plane):** Appends and streams raw binary chunks across commodity storage nodes equipped with high-density JBODs. Storage nodes have no concept of user buckets or filenames; they operate strictly on chunk IDs.

3. **Chunking, Content-Addressable Storage (CAS) & Multipart Uploads:**
   - Files are partitioned into fixed-size chunks (e.g., 16 MB to 64 MB).
   - **Content-Addressable Storage (CAS):** Chunks are identified by their cryptographic hash (e.g., SHA-256). Identical chunks across different users or files are stored only once on disk (automatic deduplication), with multiple metadata pointers referencing the same chunk.
   - **Multipart Uploads:** Chunks are ingested in parallel. If a single chunk upload fails due to transient network packet loss, only that specific part is retried rather than restarting the entire multi-gigabyte upload.

4. **The Durability Revolution: 3× Replication vs. Reed-Solomon Erasure Coding:**
   - **3× Cross-AZ Replication:** Incurs a 200% storage overhead (3.0× raw data size) and tolerates 2 lost copies. For petabyte-scale archives, raw disk costs become prohibitive.
   - **Reed-Solomon RS(8,4) Erasure Coding:** Partitions data into 8 data shards and computes 4 parity shards using Galois Field linear algebra.
     - Storage overhead is only $\frac{8 + 4}{8} = 1.5\times$ (50% overhead instead of 200%).
     - Tolerates the simultaneous failure of **any 4 storage nodes or disk chassis** without data loss.
     - Saves 50% of raw disk capacity ($13.5M/year savings on a 50 PB archive) while delivering eleven 9s (99.999999999%) of durability.

5. **Garbage Collection & Lifecycle Policies:**
   - Deleting an object removes the metadata pointer immediately; physical chunk data is reaped asynchronously by mark-and-sweep background sweepers.
   - Incomplete multipart uploads must be cleaned up via lifecycle expiration rules (`AbortIncompleteMultipartUploadAfterDays`) to avoid leaking petabytes of orphaned chunks.

## Next Steps
- Milestone 6 Practical Test: High-Throughput Telemetry Engine & Petabyte Object Archive.
