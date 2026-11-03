import React from 'react';
import { BadgeRow } from '../../components/UI/BadgeRow';
import { PrimarySourceCallout } from '../../components/UI/PrimarySourceCallout';
import { CodeWindowCard } from '../../components/UI/CodeWindowCard';
import { AIPitfallCallout } from '../../components/UI/AIPitfallCallout';
import { Quiz } from '../../components/UI/Quiz';
import { AgentReminder } from '../../components/UI/AgentReminder';
import { LessonNavButtons } from '../../components/UI/LessonNavButtons';
import { LessonHeaderStatus } from '../../components/UI/LessonHeaderStatus';
import { BlobStorageSimulator } from '../../components/Simulators/BlobStorageSimulator';

export const Lesson0014: React.FC = () => {
  return (
    <div className="page-wrapper">
      <div className="container">
        <header>
          <BadgeRow
            lessonId="0014"
            lessonBadge="Lesson 0014"
            moduleBadge="Module 6: Storage Engines &amp; Object Architecture"
            time="20 mins"
            tag="Blob Storage Sim"
          />
          <h1>Distributed Object &amp; Blob Storage: S3 Architecture, Chunking &amp; Erasure Coding</h1>
          <p className="lead-text">
            How do cloud hyperscalers store exabytes of unstructured video, images, backups, and machine learning datasets with 99.999999999% durability? Deconstruct S3-compatible object storage: separate metadata planes from immutable append-only data planes, master Content-Addressable Storage (CAS), and replace costly 3× replication with Reed-Solomon Erasure Coding.
          </p>
        </header>

        <LessonHeaderStatus lessonId="0014" />

        <PrimarySourceCallout
          sourceText={
            <p style={{ margin: 0 }}>
              <strong>Read:</strong> Alex Xu and Sahn Lam, <em>System Design Interview &ndash; An Insider&apos;s Guide: Volume 2</em>, Chapter 6: &ldquo;S3-Compatible Object Storage&rdquo;; Sage A. Weil et al., <em>Ceph: A Scalable, High-Performance Distributed File System</em> (OSDI 2006); James S. Plank, <em>A Tutorial on Reed-Solomon Coding for Fault-Tolerance in RAID-like Systems</em>; and AWS Whitepaper on <em>Amazon S3 Architecture &amp; 11 9s Durability Design</em>.
            </p>
          }
        />

        <h2>1. The Three Storage Paradigms: Block vs. File vs. Object</h2>
        <p>
          In enterprise architecture, storing unstructured data (e.g. photos, 4K videos, ML weights, PDF invoices) requires choosing the correct fundamental storage abstraction:
        </p>

        <div className="table-wrapper" style={{ margin: '20px 0' }}>
          <table>
            <thead>
              <tr>
                <th>Storage Paradigm</th>
                <th>Underlying Unit</th>
                <th>Interface &amp; Protocol</th>
                <th>Scaling Limit &amp; Trade-offs</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Block Storage</strong><br />(AWS EBS, SAN, NVMe)</td>
                <td>Raw 512B / 4KB disk sectors without files or folders</td>
                <td>SCSI / NVMe-oF / iSCSI attached directly to a single OS instance</td>
                <td>Ultra-low sub-millisecond latency for databases; cannot scale beyond a single host volume or share across thousands of nodes.</td>
              </tr>
              <tr>
                <td><strong>File Storage</strong><br />(NFS, SMB, AWS EFS)</td>
                <td>Hierarchical directory tree with nested folders and paths</td>
                <td>POSIX system calls (<code>open</code>, <code>read</code>, <code>write</code>, file locks)</td>
                <td>Shared across multiple instances; complex POSIX file locking and directory traversal metadata create severe bottlenecks beyond tens of thousands of clients.</td>
              </tr>
              <tr>
                <td><strong>Object Storage</strong><br />(AWS S3, GCS, MinIO, Ceph)</td>
                <td>Discrete, immutable binary objects in a flat namespace</td>
                <td>HTTP REST APIs (<code>GET /bucket/key</code>, <code>PUT /bucket/key</code>)</td>
                <td>Virtually infinite horizontal scale (exabytes); higher per-request latency (~10–30ms), but zero file-locking bottlenecks.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <AIPitfallCallout title='The AI Assistant Blind Spot: "Store uploaded images as Base64 in PostgreSQL or on local container disk"'>
          <p>
            When asked how to implement file or image uploads in Node.js, AI assistants frequently suggest two disastrous architectures:
          </p>
          <ul style={{ margin: '8px 0 0', paddingLeft: '20px' }}>
            <li><strong>Disaster 1: Base64 in PostgreSQL <code>BYTEA</code> / <code>TEXT</code> columns:</strong> Base64 encoding inflates file size by 33%. Storing 10 MB images inside Postgres destroys the database buffer pool cache, bloats WAL files, slows down replica synchronization to a crawl, and causes Out-Of-Memory (OOM) errors during database dumps.</li>
            <li><strong>Disaster 2: Saving to <code>fs.writeFile(&apos;./uploads/&apos; + filename)</code> on a Docker container:</strong> Containers are ephemeral. When auto-scaling provisions a second instance or Kubernetes terminates a pod, the uploaded files vanish or are unreachable by the other instances!</li>
            <li><strong>Architectural Remedy:</strong> Compute nodes must remain completely stateless. All unstructured files must be streamed directly to an Object Storage layer (S3 / MinIO) with pre-signed URLs, storing only the lightweight S3 URI/metadata in the relational database.</li>
          </ul>
        </AIPitfallCallout>

        <h2>2. The Dual-Plane Architecture: Metadata Plane vs. Data Plane</h2>
        <p>
          The secret to scaling object storage to trillions of files is the strict architectural separation between the <strong>Metadata Plane (Control Plane)</strong> and the <strong>Data Plane</strong>:
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', margin: '24px 0' }}>
          <div className="card card-cream" style={{ padding: '20px', borderRadius: '12px' }}>
            <span className="badge badge-teal" style={{ marginBottom: '8px' }}>Control Plane</span>
            <h4 style={{ margin: '8px 0' }}>The Metadata Plane</h4>
            <p style={{ fontSize: '13px', margin: 0 }}>
              Stores object attributes: <code>bucket_name</code>, <code>object_key</code>, <code>size_bytes</code>, <code>content_type</code>, <code>etag_hash</code>, <code>acl_permissions</code>, and an array of <code>chunk_ids[]</code> mapping to physical disk nodes.
              <br /><br />
              <strong>Characteristics:</strong> Very small payloads (&lt; 2 KB per object), but extreme throughput (hundreds of thousands of QPS) with sub-5ms latency requirements. Backed by distributed key-value stores (e.g., DynamoDB, Spanner, or CockroachDB).
            </p>
          </div>

          <div className="card card-cream" style={{ padding: '20px', borderRadius: '12px' }}>
            <span className="badge badge-coral" style={{ marginBottom: '8px' }}>Payload Plane</span>
            <h4 style={{ margin: '8px 0' }}>The Data Plane</h4>
            <p style={{ fontSize: '13px', margin: 0 }}>
              Responsible strictly for persisting and streaming raw binary bytes.
              <br /><br />
              <strong>Characteristics:</strong> Massive payloads (megabytes to gigabytes). Storage nodes are simple, append-only disk servers running high-density JBODs (&ldquo;Just a Bunch of Disks&rdquo;) without RAID controllers. Storage nodes have zero knowledge of user buckets, filenames, or authentication; they only store raw chunks identified by chunk hashes.
            </p>
          </div>
        </div>

        <h2>3. Chunking, Content-Addressable Storage (CAS) &amp; Multipart Uploads</h2>
        <p>
          Large objects (e.g. a 4 GB video or 100 GB database archive) cannot be uploaded or stored as a single contiguous file without operational fragility.
        </p>

        <h3>1. Chunking &amp; Content-Addressable Storage (CAS)</h3>
        <p>
          The ingestion gateway divides incoming streams into fixed or variable-sized chunks (typically 16 MB to 64 MB).
          Each chunk is passed through a cryptographic hash function (e.g. SHA-256) to produce a unique <strong>Content-Addressable Identifier</strong>:
        </p>
        <div style={{ background: '#f5f4f0', padding: '12px 16px', borderRadius: '8px', margin: '14px 0', fontFamily: 'var(--font-mono)', fontSize: '13px', border: '1px solid var(--color-hairline)' }}>
          chunk_id = SHA256(chunk_bytes) // e.g. "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        </div>
        <p>
          <strong>Automatic Deduplication:</strong> If 10,000 corporate employees upload the same 200 MB keynote presentation or OS update, the storage engine computes identical SHA-256 hashes for all chunks. The storage node writes the chunk to disk <em>only once</em>, and the metadata service simply creates 10,000 pointers referencing the same underlying chunk!
        </p>

        <h3>2. Resumable Multipart Uploads</h3>
        <p>
          Uploading a 10 GB file over public internet will frequently experience transient network dropouts. If the upload is monolithic, a failure at 9.9 GB requires restarting from 0 GB.
          With <strong>Multipart Uploads</strong>:
        </p>
        <ol>
          <li>The client calls <code>InitiateMultipartUpload</code> &rarr; receives an <code>UploadId</code>.</li>
          <li>The client uploads chunks in parallel (e.g. 5 concurrent HTTP connections) with part numbers (1 to $N$).</li>
          <li>If Part 7 fails due to a packet drop, only Part 7 (16 MB) is retried.</li>
          <li>Once all parts complete, the client calls <code>CompleteMultipartUpload</code> with the list of part ETags; the metadata service stitches the chunk map atomically.</li>
        </ol>

        <h2>4. The Durability Revolution: 3× Replication vs. Reed-Solomon Erasure Coding</h2>
        <p>
          How do cloud providers guarantee &ldquo;eleven 9s&rdquo; (99.999999999%) of durability without bankrupting their infrastructure budgets?
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', margin: '20px 0' }}>
          <div className="card card-cream" style={{ padding: '20px', borderRadius: '12px' }}>
            <span className="badge badge-teal" style={{ marginBottom: '8px' }}>Naive Approach</span>
            <h4 style={{ margin: '8px 0' }}>3× Cross-AZ Replication</h4>
            <p style={{ fontSize: '13px', margin: 0 }}>
              Store 3 complete copies of every chunk across 3 Availability Zones.
              <br /><br />
              <strong>The Math:</strong> Storing 100 Petabytes of raw data requires <strong>300 Petabytes of hard drives</strong> (200% storage overhead).
              <br />
              <strong>Fault Tolerance:</strong> Can tolerate losing 2 copies before data is permanently lost.
            </p>
          </div>

          <div className="card card-cream" style={{ padding: '20px', borderRadius: '12px' }}>
            <span className="badge badge-coral" style={{ marginBottom: '8px' }}>Hyperscale Standard</span>
            <h4 style={{ margin: '8px 0' }}>Reed-Solomon Erasure Coding RS(N, M)</h4>
            <p style={{ fontSize: '13px', margin: 0 }}>
              Break data into $N$ data chunks and calculate $M$ parity chunks using Galois Field linear algebra.
              <br /><br />
              <strong>The Math (RS 8+4):</strong> 8 Data + 4 Parity = 12 total chunks. Storage overhead is only (8 + 4) / 8 = <strong>1.5&times;</strong> (50% overhead instead of 200%!).
              <br />
              <strong>Fault Tolerance:</strong> Can tolerate losing <strong>any 4 storage nodes or disk racks simultaneously</strong> without any data loss!
            </p>
          </div>
        </div>

        <h3>The Linear Algebra Behind Erasure Coding</h3>
        <p>
          In an $RS(N, M)$ scheme, any $N$ chunks out of the total $N + M$ chunks are mathematically sufficient to reconstruct the entire file.
          Think of it as solving a system of linear equations: if you have $N$ unknowns, you only need any $N$ independent equations to solve for all original variables.
        </p>
        <p>
          <strong>Cost Comparison for a 50 Petabyte Archive:</strong>
        </p>
        <ul>
          <li><strong>3× Replication:</strong> Requires 150 PB of physical storage. At $0.015/GB/month, annual disk cost is <strong>$27,000,000 / year</strong>.</li>
          <li><strong>8+4 Erasure Coding:</strong> Requires only 75 PB of physical storage. Annual disk cost drops to <strong>$13,500,000 / year</strong> &mdash; an immediate savings of <strong>$13.5M annually</strong> with vastly higher fault tolerance!</li>
        </ul>

        <h2>5. Garbage Collection &amp; Tombstone Reaping</h2>
        <p>
          When an object is deleted or replaced:
        </p>
        <ul>
          <li>The metadata service marks the object as deleted in the database (or records a tombstone). The delete operation returns HTTP 204 to the client in &lt; 5ms.</li>
          <li>The underlying data chunks on disk are <em>not erased synchronously</em>. Doing so would cause random disk seeks and slow down active read/write traffic.</li>
          <li><strong>Mark-and-Sweep Background Sweeper:</strong> Periodically sweeps chunk reference counters. Any chunk with zero active metadata references is reclaimed in bulk sequential passes.</li>
          <li><strong>Incomplete Multipart Upload Trap:</strong> Clients that abort or crash during multipart uploads leave orphaned chunks occupying petabytes of storage. Production S3 buckets enforce lifecycle rules (<code>AbortIncompleteMultipartUploadAfterDays = 7</code>) to automatically delete orphaned parts.</li>
        </ul>

        <h2>6. Interactive Architecture Simulator: Object Storage &amp; Erasure Coding</h2>
        <p>
          Interact directly with the distributed object storage cluster below. Upload objects, inspect chunking and Content-Addressable Storage (CAS) deduplication, inject node failures across availability zones, and test Reed-Solomon data reconstruction:
        </p>

        <BlobStorageSimulator />

        <h2>7. Production Implementation: Multipart Upload Coordinator in TypeScript</h2>
        <p>
          Below is a production-grade TypeScript implementation of a resilient Multipart Upload Manager that splits incoming streams, calculates SHA-256 chunk hashes, and maps parts to storage nodes:
        </p>

        <CodeWindowCard
          title="object-storage-coordinator.ts"
          code={`// Production-Grade Distributed Object Storage Coordinator in TypeScript
import * as crypto from 'crypto';

export interface ChunkDescriptor {
  partNumber: number;
  chunkId: string; // SHA-256 CAS identifier
  sizeBytes: number;
  assignedNodeId: number;
  etag: string;
}

export interface ObjectMetadata {
  bucket: string;
  key: string;
  uploadId: string;
  totalSize: number;
  chunks: ChunkDescriptor[];
  status: 'INITIATED' | 'COMPLETED' | 'ABORTED';
  createdAt: Date;
}

export class ObjectStorageCoordinator {
  private metadataStore: Map<string, ObjectMetadata> = new Map();
  private availableNodes: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  public readonly CHUNK_SIZE = 16 * 1024 * 1024; // 16 MB chunks

  // Step 1: Initiate Multipart Upload (Metadata Plane)
  public initiateMultipartUpload(bucket: string, key: string): string {
    const uploadId = \`upl_\${crypto.randomBytes(8).toString('hex')}\`;
    const meta: ObjectMetadata = {
      bucket,
      key,
      uploadId,
      totalSize: 0,
      chunks: [],
      status: 'INITIATED',
      createdAt: new Date(),
    };
    this.metadataStore.set(uploadId, meta);
    return uploadId;
  }

  // Step 2: Upload Individual Chunk (Data Plane)
  public async uploadPart(
    uploadId: string,
    partNumber: number,
    buffer: Buffer
  ): Promise<string> {
    const meta = this.metadataStore.get(uploadId);
    if (!meta || meta.status !== 'INITIATED') {
      throw new Error('Invalid or expired upload ID');
    }

    // Content-Addressable Storage: SHA-256 checksum of payload
    const chunkId = crypto.createHash('sha256').update(buffer).digest('hex');
    const etag = \`"\${chunkId.slice(0, 32)}"\`;

    // Map chunk to storage node (Consistent Hashing or Round Robin)
    const assignedNodeId = this.availableNodes[(partNumber - 1) % this.availableNodes.length];

    // In production, stream buffer over TCP/gRPC to physical storage node
    meta.chunks.push({
      partNumber,
      chunkId,
      sizeBytes: buffer.length,
      assignedNodeId,
      etag,
    });
    meta.totalSize += buffer.length;

    return etag;
  }

  // Step 3: Complete Multipart Upload (Atomic Metadata Commit)
  public completeMultipartUpload(
    uploadId: string,
    providedParts: { partNumber: number; etag: string }[]
  ): ObjectMetadata {
    const meta = this.metadataStore.get(uploadId);
    if (!meta || meta.status !== 'INITIATED') {
      throw new Error('Upload session invalid');
    }

    // Verify all parts match recorded ETags
    for (const provided of providedParts) {
      const recorded = meta.chunks.find((c) => c.partNumber === provided.partNumber);
      if (!recorded || recorded.etag !== provided.etag) {
        throw new Error(\`Part \${provided.partNumber} integrity verification failed!\`);
      }
    }

    // Sort chunks strictly by partNumber
    meta.chunks.sort((a, b) => a.partNumber - b.partNumber);
    meta.status = 'COMPLETED';

    return meta;
  }

  // Step 4: Abort & Garbage Collect Unfinished Uploads
  public abortMultipartUpload(uploadId: string): void {
    const meta = this.metadataStore.get(uploadId);
    if (meta) {
      meta.status = 'ABORTED';
      // Signal storage nodes to mark unreferenced chunks for async GC sweep
      meta.chunks = [];
    }
  }
}`}
        />

        <h2>8. Active Retrieval &amp; Architectural Verification</h2>
        <p>
          Test your comprehension of distributed object storage, chunking, and erasure coding:
        </p>

        <Quiz
          id="quiz_0014_1"
          question="1. In a large-scale S3-compatible architecture, why are the Metadata Plane and Data Plane decoupled into separate subsystems?"
          options={[
            {
              text: 'Because metadata requires low-latency key-value queries, while the data plane streams massive immutable binary chunks.',
              isCorrect: true,
              explanation: 'Metadata demands sub-5ms random reads/writes on small records, whereas data nodes are append-only streaming engines optimized for bulk throughput.'
            },
            {
              text: 'Because relational database licenses forbid storing binary objects larger than 64 kilobytes across server clusters.',
              isCorrect: false,
              explanation: 'Database licenses do not enforce binary size limits; separation is driven by I/O profiles and storage economics.'
            },
            {
              text: 'Because Layer 7 load balancers cannot route HTTP GET requests to servers that have attached solid-state storage.',
              isCorrect: false,
              explanation: 'Load balancers route HTTP traffic regardless of the storage media attached to upstream servers.'
            },
            {
              text: 'Because the POSIX file system standard requires file names to be processed exclusively in volatile kernel memory.',
              isCorrect: false,
              explanation: 'Object storage intentionally bypasses POSIX file systems; POSIX does not require volatile memory processing.'
            }
          ]}
        />

        <Quiz
          id="quiz_0014_2"
          question="2. In an 8+4 Reed-Solomon Erasure Coding scheme, what is the exact storage overhead ratio and failure tolerance limit?"
          options={[
            {
              text: 'It incurs a 300% storage overhead and can tolerate the failure of at most 1 storage node or disk drive.',
              isCorrect: false,
              explanation: '300% overhead (3x) describes 3x replication, not Reed-Solomon erasure coding.'
            },
            {
              text: 'It incurs an 80% storage overhead and requires all 12 storage nodes to remain online to execute data reads.',
              isCorrect: false,
              explanation: 'RS(8,4) overhead is (8+4)/8 = 1.5x (50% overhead), and it allows up to 4 nodes to be completely offline.'
            },
            {
              text: 'It incurs a 50% storage overhead (1.5× raw size) and can survive the simultaneous loss of any 4 storage nodes.',
              isCorrect: true,
              explanation: 'Total chunks = 12, Data chunks = 8. Overhead = 12/8 = 1.5x (50% overhead). Any 8 of the 12 chunks can reconstruct the full object, surviving 4 failures.'
            },
            {
              text: 'It incurs zero storage overhead because cryptographic hashes compress all 8 data chunks into a single byte.',
              isCorrect: false,
              explanation: 'Cryptographic hashes do not compress payloads to a single byte; parity chunks require physical storage space.'
            }
          ]}
        />

        <Quiz
          id="quiz_0014_3"
          question="3. How does Content-Addressable Storage (CAS) achieve storage deduplication across millions of user file uploads?"
          options={[
            {
              text: 'By renaming every uploaded file with an incremental 64-bit sequence counter generated by Twitter Snowflake.',
              isCorrect: false,
              explanation: 'Snowflake generates unique IDs, but unique IDs do not identify identical chunk payloads.'
            },
            {
              text: 'By indexing chunks by their cryptographic SHA-256 hash, allowing duplicate payloads to point to existing chunks.',
              isCorrect: true,
              explanation: 'Because the chunk identifier is derived directly from the content hash, identical chunks have identical IDs and need only be stored once on disk.'
            },
            {
              text: 'By scanning user hard drives before upload to delete duplicate files from client operating system caches.',
              isCorrect: false,
              explanation: 'Object storage services have no access or permission to modify client operating system hard drives.'
            },
            {
              text: 'By converting all video and image payloads into compressed ASCII text before writing to solid-state disks.',
              isCorrect: false,
              explanation: 'Binary files are stored as raw binary chunks, not converted to inefficient ASCII representations.'
            }
          ]}
        />

        <AgentReminder
          title="Architect Standby: Lesson 0014 Review"
          promptText="I have completed Lesson 0014 on Distributed Object Storage, Chunking, and Erasure Coding. Please quiz me on how Reed-Solomon RS(8,4) compares to 3x replication, how multipart uploads handle network drops, and how to design an S3-compatible metadata plane."
        />

        <LessonNavButtons currentLessonId="0014" />
      </div>
    </div>
  );
};
