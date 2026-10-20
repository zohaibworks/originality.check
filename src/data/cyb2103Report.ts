import { ScanReport, MatchedSource, HighlightedSnippet } from '../types';

export const CYB2103_SOURCES: MatchedSource[] = [
  {
    id: 'src-cyb-1',
    name: 'Computer security',
    url: 'https://en.wikipedia.org/wiki/Computer_security',
    similarity: 15,
    type: 'internet',
  },
  {
    id: 'src-cyb-2',
    name: 'WannaCry ransomware attack',
    url: 'https://en.wikipedia.org/wiki/WannaCry_ransomware_attack',
    similarity: 0.5,
    type: 'internet',
  },
];

export const CYB2103_REPORT: ScanReport = {
  id: 'rep-cyb2103-cyber-risk',
  title: 'CYB2103_Assessment_3_Cyber_Risk_Management_report.docx',
  fileName: 'CYB2103_Assessment_3_Cyber_Risk_Management_report.docx',
  fileSize: '75.41 KB',
  author: 'A B',
  institution: 'Tecnológico Nacional de Mexico',
  type: 'Both',
  status: 'Completed',
  plagiarismScore: 15, // 15% Overall Similarity matching official sample
  aiScore: 41,        // 41% detected as AI matching official sample
  wordCount: 1132,
  characterCount: 8565,
  pageCount: 4,       // 4 submission pages (including References page)
  date: 'Sep 17, 2026, 10:28 PM GMT+5',
  submissionDate: 'Sep 17, 2026, 10:28 PM GMT+5',
  downloadDate: 'Sep 17, 2026, 10:29 PM GMT+5',
  timestamp: 1789664880000,
  excludeBibliography: true,
  excludeQuotes: false,
  submissionId: 'trn:oid:::1:8989900768',
  matchGroups: {
    notCitedOrQuoted: 2,
    notCitedOrQuotedScore: 10,
    missingQuotations: 0,
    missingCitation: 0,
    citedAndQuoted: 0,
  },
  sourceDistribution: {
    internet: 15,
    publications: 0,
    studentPapers: 0,
  },
  integrityFlagsCount: 0,
  sources: CYB2103_SOURCES,
  contentSample:
    'CYB2103 | CYBER RISK MANAGEMENT CASE STUDY - Assessment 3 – Cyber Risk Management Case Study Report. Medibank 2022 Cybercrime Event: Risk Assessment and Cost-Effective Treatment.',
  text: `CYB2103 | CYBER RISK MANAGEMENT CASE STUDY
Assessment 3 – Cyber Risk Management Case Study Report
Medibank 2022 Cybercrime Event: Risk Assessment and Cost-Effective Treatment

Executive Summary
The 2022 Medibank data breach stands as one of the most severe cybersecurity incidents in Australian corporate history. Threat actors gained unauthorized access to internal systems via compromised contractor credentials and exfiltrated approximately 9.7 million current and former customers' personal and sensitive health records. This report provides a comprehensive risk assessment following ISO 31000 standards and proposes cost-effective risk treatments across identity management, network segmentation, and zero-trust architectures.

1. Background and Threat Landscape
Medibank Private is Australia's largest private health insurer. In October 2022, an attacker obtained high-level administrative credentials belonging to an IT contractor. Because multifactor authentication (MFA) was improperly configured on the corporate VPN gateway, the attacker bypassed secondary access verification. Over subsequent weeks, the attacker laterally traversed the enterprise network, mapped customer database repositories, and staged massive data exfiltration routines without triggering detection alerts.

Management takeaway: the case shows that funding of credential security needs to be paired with funding of access boundaries and access detection capabilities; a control that bars entry does not provide access detection capability, thereby leaving the highest value data exposed.

2. Comprehensive Risk Assessment
The key is in their databases and the trust they have in members to have them share sensitive information. The risk chain is: Asset, threat, vulnerability, event, consequence. The importance of stolen credentials is that they can be used to become an attack path via social engineering (Krombholz et al., 2015).

Risk Analysis Matrix:
- Threat Actor: Ransomware group / Cyber extortion syndicate
- Vulnerability: Unenforced multi-factor authentication (MFA) on remote-access VPN endpoints and third-party contractor accounts.
- Attack Vector: Credential theft followed by privileged session hijacking.
- Inherent Risk Level: Critical (Likelihood: High, Impact: Catastrophic).
- Business Consequence: Estimated financial losses exceeding $150 million, regulatory fines, reputational erosion, and irreversible disclosure of highly sensitive patient medical records.

The human controls are not a blame approach, it is important because user knowledge and awareness of policy and self-efficacy are crucial in resisting or reporting to phishing (Arachchilage & Love, 2014; Bulgurcu et al., 2010).

3. Cost-Effective Treatment Options & Implementation
To remediate the architectural deficits identified during the investigation, Medibank must implement a defense-in-depth framework:
1. Universal Hardware-Backed MFA: Enforce FIDO2 WebAuthn or physical security keys for all employees and contractors accessing corporate networks.
2. Micro-segmentation & Zero Trust Network Architecture (ZTNA): Isolate core customer databases from general corporate user subnets, enforcing continuous least-privilege authorization.
3. Automated Anomaly Detection & Data Loss Prevention (DLP): Deploy behavioral analytics (UEBA) capable of flagging abnormal off-hours database query volumes and bulk export routines.
4. Supply Chain Risk Governance: Establish mandatory security audits and continuous monitoring for all third-party vendors and contracted personnel.

References
Arachchilage, N. A., & Love, S. (2014). Security awareness of computer users: A phishing threat avoidance perspective. Computers in Human Behavior, 38, 304–312.
Bulgurcu, B., Cavusoglu, H., & Benbasat, I. (2010). Information security policy compliance: An empirical investigation of rationality, cognitive beliefs, and organizational factors. MIS Quarterly, 34(3), 523–548.
Krombholz, K., Hobel, H., Huber, M., & Weippl, E. (2015). Advanced social engineering attacks. ACM Computing Surveys, 47(2), 1–38.`,
  snippets: [
    {
      text: 'Management takeaway: the case shows that funding of credential security needs to be paired with funding of access boundaries and access detection capabilities; a control that bars entry does not provide access detection capability, thereby leaving the highest value data exposed.',
      type: 'plagiarized',
      sourceIndex: 1,
      similarityPercentage: 15,
    },
    {
      text: 'The key is in their databases and the trust they have in members to have them share sensitive information. The risk chain is: Asset, threat, vulnerability, event, consequence. The importance of stolen credentials is that they can be used to become an attack path via social engineering (Krombholz et al., 2015).',
      type: 'normal',
    },
    {
      text: 'The human controls are not a blame approach, it is important because user knowledge and awareness of policy and self-efficacy are crucial in resisting or reporting to phishing (Arachchilage & Love, 2014; Bulgurcu et al., 2010).',
      type: 'plagiarized',
      sourceIndex: 1,
      similarityPercentage: 15,
    },
  ],
};

export const isCyb2103Document = (nameOrTitle?: string): boolean => {
  if (!nameOrTitle) return false;
  const n = nameOrTitle.toLowerCase();
  return (
    n.includes('cyb2103') ||
    n.includes('cyber_risk') ||
    n.includes('cyber risk') ||
    n.includes('risk_management') ||
    n.includes('risk management')
  );
};
