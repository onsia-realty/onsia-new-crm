import crypto from 'crypto';

// NCP SENS 설정 타입
interface SensConfig {
  accessKey: string;
  secretKey: string;
  serviceId: string;
  channelId: string; // @카카오채널ID
}

// 알림톡 메시지 타입
interface AlimtalkMessage {
  to: string;           // 수신자 전화번호 (01012345678)
  content?: string;     // 메시지 내용 (템플릿 사용시 빈값)
  buttons?: Array<{
    type: string;       // WL, AL, DS, BK, MD
    name: string;
    linkMobile?: string;
    linkPc?: string;
  }>;
}

// 알림톡 요청 바디 타입
interface AlimtalkRequest {
  plusFriendId: string;
  templateCode: string;
  messages: AlimtalkMessage[];
  reserveTime?: string;
  scheduleCode?: string;
}

// 발송 결과 타입
interface SendResult {
  requestId: string;
  requestTime: string;
  statusCode: string;
  statusName: string;
  messages?: Array<{
    messageId: string;
    to: string;
    requestStatusCode: string;
    requestStatusName: string;
    requestStatusDesc?: string;
  }>;
}

/**
 * NCP SENS API 서명 생성
 */
function makeSignature(
  method: string,
  url: string,
  timestamp: string,
  accessKey: string,
  secretKey: string
): string {
  const space = ' ';
  const newLine = '\n';
  const message = method + space + url + newLine + timestamp + newLine + accessKey;
  const hmac = crypto.createHmac('sha256', secretKey);
  hmac.update(message);
  return hmac.digest('base64');
}

/**
 * 전화번호 정규화 (숫자만 추출)
 */
function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, '');
}

/**
 * NCP SENS 알림톡 발송 클래스
 */
export class NcpSensClient {
  private config: SensConfig;
  private baseUrl = 'https://sens.apigw.ntruss.com';

  constructor() {
    this.config = {
      accessKey: process.env.NCP_ACCESS_KEY || '',
      secretKey: process.env.NCP_SECRET_KEY || '',
      serviceId: process.env.NCP_SENS_SERVICE_ID || '',
      channelId: process.env.NCP_KAKAO_CHANNEL_ID || '',
    };
  }

  /**
   * 설정이 완료되었는지 확인
   */
  isConfigured(): boolean {
    return !!(
      this.config.accessKey &&
      this.config.secretKey &&
      this.config.serviceId &&
      this.config.channelId
    );
  }

  /**
   * 알림톡 발송
   */
  async sendAlimtalk(
    templateCode: string,
    messages: Array<{ to: string; content: string }>
  ): Promise<SendResult> {
    if (!this.isConfigured()) {
      throw new Error('NCP SENS 설정이 완료되지 않았습니다.');
    }

    const url = `/alimtalk/v2/services/${this.config.serviceId}/messages`;
    const method = 'POST';
    const timestamp = Date.now().toString();
    const signature = makeSignature(
      method,
      url,
      timestamp,
      this.config.accessKey,
      this.config.secretKey
    );

    const body: AlimtalkRequest = {
      plusFriendId: this.config.channelId,
      templateCode,
      messages: messages.map((msg) => ({
        to: normalizePhone(msg.to),
        content: msg.content,
      })),
    };

    const response = await fetch(`${this.baseUrl}${url}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'x-ncp-apigw-timestamp': timestamp,
        'x-ncp-iam-access-key': this.config.accessKey,
        'x-ncp-apigw-signature-v2': signature,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`알림톡 발송 실패: ${error}`);
    }

    return response.json();
  }

  /**
   * 업무보고 알림톡 발송
   */
  async sendDailyReportNotification(
    phone: string,
    data: {
      name: string;
      date: string;
      clockIn?: string;
      clockOut?: string;
      customersCreated: number;
      callLogsCreated: number;
      contractsCount: number;
      subscriptionsCount: number;
      visitsCount: number;
    }
  ): Promise<SendResult> {
    const templateCode = process.env.NCP_ALIMTALK_TEMPLATE_REPORT || 'DAILY_REPORT';

    // 템플릿 내용 생성
    let content = `[${data.name}]님의 업무보고\n`;
    content += `📅 ${data.date}\n\n`;

    if (data.clockIn) {
      content += `⏰ 출근: ${data.clockIn}\n`;
    }
    if (data.clockOut) {
      content += `⏰ 퇴근: ${data.clockOut}\n`;
    }

    content += `\n📊 업무 현황\n`;
    content += `• 고객 등록: ${data.customersCreated}건\n`;
    content += `• 통화/메모: ${data.callLogsCreated}건\n`;
    content += `• 방문 일정: ${data.visitsCount}건\n`;
    content += `• 계약: ${data.contractsCount}건\n`;
    content += `• 청약: ${data.subscriptionsCount}건`;

    return this.sendAlimtalk(templateCode, [{ to: phone, content }]);
  }

  /**
   * 출퇴근 알림톡 발송
   */
  async sendClockNotification(
    phone: string,
    data: {
      name: string;
      type: 'in' | 'out';
      time: string;
    }
  ): Promise<SendResult> {
    const templateCode = process.env.NCP_ALIMTALK_TEMPLATE_CLOCK || 'CLOCK_IN_OUT';

    const typeText = data.type === 'in' ? '출근' : '퇴근';
    const content = `[${data.name}]님이 ${typeText}하셨습니다.\n시간: ${data.time}`;

    return this.sendAlimtalk(templateCode, [{ to: phone, content }]);
  }
}

// 싱글톤 인스턴스
export const sensClient = new NcpSensClient();
