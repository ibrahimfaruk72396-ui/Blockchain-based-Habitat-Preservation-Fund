;; ProjectProposal.clar
;; Smart contract for managing habitat preservation project proposals in the Blockchain-based Habitat Preservation Fund.
;; This contract allows authorized users (e.g., conservation organizations) to submit detailed project proposals,
;; including budgets, timelines, milestones, and supporting metadata. Proposals can be queried, updated (with restrictions),
;; and integrated with governance for approval. It ensures immutability where possible and provides robust validation.

;; Constants
(define-constant ERR-UNAUTHORIZED u100) ;; Caller not authorized
(define-constant ERR-INVALID-PROPOSAL-ID u101) ;; Invalid or non-existent proposal ID
(define-constant ERR-PROPOSAL-EXISTS u102) ;; Proposal with same hash already exists
(define-constant ERR-INVALID-BUDGET u103) ;; Budget must be positive
(define-constant ERR-INVALID-TIMELINE u104) ;; Start must be before end
(define-constant ERR-TOO-MANY-MILESTONES u105) ;; Exceeds max milestones
(define-constant ERR-INVALID-STATUS u106) ;; Invalid status transition
(define-constant ERR-METADATA-TOO-LONG u107) ;; Metadata exceeds length
(define-constant ERR-ALREADY-FINALIZED u108) ;; Proposal is finalized and cannot be updated
(define-constant ERR-INVALID-PROPOSER u109) ;; Invalid proposer principal
(define-constant ERR-MAX-TAGS-EXCEEDED u110) ;; Too many tags
(define-constant ERR-INVALID-TAG u111) ;; Invalid tag length

(define-constant MAX-MILESTONES u10) ;; Maximum number of milestones per proposal
(define-constant MAX-METADATA-LEN u1000) ;; Max length for description/metadata
(define-constant MAX-TAGS u5) ;; Max tags per proposal
(define-constant MAX-TAG-LEN u50) ;; Max length per tag

;; Status enums (using uint for simplicity)
(define-constant STATUS-PENDING u0)
(define-constant STATUS-APPROVED u1)
(define-constant STATUS-REJECTED u2)
(define-constant STATUS-ONGOING u3)
(define-constant STATUS-COMPLETED u4)
(define-constant STATUS-CANCELLED u5)

;; Data Maps
(define-map proposals
  { proposal-id: uint } ;; Unique auto-incrementing ID
  {
    proposer: principal, ;; Submitter's principal
    title: (string-utf8 100), ;; Project title
    description: (string-utf8 1000), ;; Detailed description
    budget: uint, ;; Requested budget in micro-STX (uSTX)
    start-block: uint, ;; Proposed start block height
    end-block: uint, ;; Proposed end block height
    milestones: (list 10 { description: (string-utf8 200), budget-allocation: uint, required-proof: (string-utf8 100) }), ;; List of milestones
    status: uint, ;; Current status
    submission-block: uint, ;; Block height of submission
    tags: (list 5 (string-utf8 50)), ;; Categorization tags (e.g., "reforestation", "wildlife")
    metadata-hash: (optional (buff 32)), ;; Optional hash of additional off-chain metadata
    vote-count-for: uint, ;; Accumulated votes in favor (integrated with governance)
    vote-count-against: uint ;; Accumulated votes against
  }
)

(define-map proposal-by-hash
  { hash: (buff 32) } ;; SHA-256 hash of proposal content for uniqueness
  { proposal-id: uint }
)

;; Non-fungible auto-incrementing counter for proposal IDs
(define-data-var next-proposal-id uint u1)

;; Admin principal (set to contract deployer initially)
(define-data-var admin principal tx-sender)

;; Trait for governance integration (optional, for future extensions)
(define-trait governance-trait
  (
    (update-proposal-status (uint uint) (response bool uint))
    (add-vote (uint principal bool) (response bool uint))
  )
)

;; Private Functions
(define-private (compute-proposal-hash (title (string-utf8 100)) (description (string-utf8 1000)) (budget uint) (milestones (list 10 { description: (string-utf8 200), budget-allocation: uint, required-proof: (string-utf8 100) })))
  (hash160 (fold concat-buffs (list (sha256 title) (sha256 description) (sha256 (fold + (map get budget-allocation milestones) u0)) ) 0x))
)

(define-private (concat-buffs (a (buff 32)) (b (buff 32)))
  (concat a b)
)

(define-private (validate-milestones (milestones (list 10 { description: (string-utf8 200), budget-allocation: uint, required-proof: (string-utf8 100) })))
  (and
    (<= (len milestones) MAX-MILESTONES)
    (> (fold + (map get budget-allocation milestones) u0) u0) ;; Total allocation > 0
  )
)

(define-private (validate-tags (tags (list 5 (string-utf8 50))))
  (and
    (<= (len tags) MAX-TAGS)
    (fold and (map (lambda (tag) (<= (len tag) MAX-TAG-LEN)) tags) true)
  )
)

;; Public Functions
(define-public (submit-proposal 
  (title (string-utf8 100))
  (description (string-utf8 1000))
  (budget uint)
  (start-block uint)
  (end-block uint)
  (milestones (list 10 { description: (string-utf8 200), budget-allocation: uint, required-proof: (string-utf8 100) }))
  (tags (list 5 (string-utf8 50)))
  (metadata-hash (optional (buff 32))))
  (let
    (
      (proposal-hash (compute-proposal-hash title description budget milestones))
      (existing (map-get? proposal-by-hash { hash: proposal-hash }))
      (id (var-get next-proposal-id))
      (current-block block-height)
    )
    (asserts! (is-none existing) (err ERR-PROPOSAL-EXISTS))
    (asserts! (> budget u0) (err ERR-INVALID-BUDGET))
    (asserts! (< start-block end-block) (err ERR-INVALID-TIMELINE))
    (asserts! (validate-milestones milestones) (err ERR-TOO-MANY-MILESTONES))
    (asserts! (<= (len description) MAX-METADATA-LEN) (err ERR-METADATA-TOO-LONG))
    (asserts! (validate-tags tags) (err ERR-MAX-TAGS-EXCEEDED))
    (asserts! (not (is-eq tx-sender 'SP000000000000000000002Q6VF78)) (err ERR-INVALID-PROPOSER)) ;; Example invalid principal check
    (map-set proposals
      { proposal-id: id }
      {
        proposer: tx-sender,
        title: title,
        description: description,
        budget: budget,
        start-block: start-block,
        end-block: end-block,
        milestones: milestones,
        status: STATUS-PENDING,
        submission-block: current-block,
        tags: tags,
        metadata-hash: metadata-hash,
        vote-count-for: u0,
        vote-count-against: u0
      }
    )
    (map-set proposal-by-hash { hash: proposal-hash } { proposal-id: id })
    (var-set next-proposal-id (+ id u1))
    (ok id)
  )
)

(define-public (update-proposal-status (proposal-id uint) (new-status uint))
  (let
    (
      (proposal (map-get? proposals { proposal-id: proposal-id }))
      (current-status (get status (unwrap! proposal (err ERR-INVALID-PROPOSAL-ID))))
    )
    (asserts! (is-eq tx-sender (var-get admin)) (err ERR-UNAUTHORIZED)) ;; For now, admin only; integrate governance later
    (asserts! (not (is-eq current-status STATUS-COMPLETED)) (err ERR-ALREADY-FINALIZED))
    (asserts! (or (is-eq new-status STATUS-APPROVED) (is-eq new-status STATUS-REJECTED) (is-eq new-status STATUS-ONGOING) (is-eq new-status STATUS-COMPLETED) (is-eq new-status STATUS-CANCELLED)) (err ERR-INVALID-STATUS))
    (map-set proposals
      { proposal-id: proposal-id }
      (merge (unwrap! proposal (err ERR-INVALID-PROPOSAL-ID)) { status: new-status })
    )
    (ok true)
  )
)

(define-public (add-vote (proposal-id uint) (vote-for bool))
  (let
    (
      (proposal (map-get? proposals { proposal-id: proposal-id }))
    )
    (asserts! (is-some proposal) (err ERR-INVALID-PROPOSAL-ID))
    (asserts! (is-eq (get status (unwrap! proposal (err ERR-INVALID-PROPOSAL-ID))) STATUS-PENDING) (err ERR-INVALID-STATUS))
    ;; In full system, check if voter has governance tokens; here, assume authorized
    (asserts! (not (is-eq tx-sender (get proposer (unwrap! proposal (err ERR-INVALID-PROPOSAL-ID))))) (err ERR-UNAUTHORIZED)) ;; Proposer can't vote
    (map-set proposals
      { proposal-id: proposal-id }
      (merge (unwrap! proposal (err ERR-INVALID-PROPOSAL-ID))
        (if vote-for
          { vote-count-for: (+ (get vote-count-for (unwrap! proposal (err ERR-INVALID-PROPOSAL-ID))) u1) }
          { vote-count-against: (+ (get vote-count-against (unwrap! proposal (err ERR-INVALID-PROPOSAL-ID))) u1) }
        )
      )
    )
    (ok true)
  )
)

(define-public (update-metadata (proposal-id uint) (new-metadata-hash (buff 32)))
  (let
    (
      (proposal (map-get? proposals { proposal-id: proposal-id }))
    )
    (asserts! (is-some proposal) (err ERR-INVALID-PROPOSAL-ID))
    (asserts! (is-eq tx-sender (get proposer (unwrap! proposal (err ERR-INVALID-PROPOSAL-ID)))) (err ERR-UNAUTHORIZED))
    (asserts! (is-eq (get status (unwrap! proposal (err ERR-INVALID-PROPOSAL-ID))) STATUS-PENDING) (err ERR-ALREADY-FINALIZED))
    (map-set proposals
      { proposal-id: proposal-id }
      (merge (unwrap! proposal (err ERR-INVALID-PROPOSAL-ID)) { metadata-hash: (some new-metadata-hash) })
    )
    (ok true)
  )
)

;; Read-Only Functions
(define-read-only (get-proposal-details (proposal-id uint))
  (map-get? proposals { proposal-id: proposal-id })
)

(define-read-only (get-next-proposal-id)
  (ok (var-get next-proposal-id))
)

(define-read-only (get-proposal-by-hash (hash (buff 32)))
  (let ((id (map-get? proposal-by-hash { hash: hash })))
    (match id
      some-id (get-proposal-details (get proposal-id some-id))
      none none
    )
  )
)

(define-read-only (get-proposal-status (proposal-id uint))
  (let ((proposal (map-get? proposals { proposal-id: proposal-id })))
    (match proposal
      some-prop (ok (get status some-prop))
      none (err ERR-INVALID-PROPOSAL-ID)
    )
  )
)

(define-read-only (get-vote-counts (proposal-id uint))
  (let ((proposal (map-get? proposals { proposal-id: proposal-id })))
    (match proposal
      some-prop (ok { for: (get vote-count-for some-prop), against: (get vote-count-against some-prop) })
      none (err ERR-INVALID-PROPOSAL-ID)
    )
  )
)

(define-read-only (is-proposal-active (proposal-id uint))
  (let ((status (unwrap! (get-proposal-status proposal-id) false)))
    (or (is-eq status STATUS-PENDING) (is-eq status STATUS-APPROVED) (is-eq status STATUS-ONGOING))
  )
)

;; Admin Functions
(define-public (set-admin (new-admin principal))
  (begin
    (asserts! (is-eq tx-sender (var-get admin)) (err ERR-UNAUTHORIZED))
    (var-set admin new-admin)
    (ok true)
  )
)