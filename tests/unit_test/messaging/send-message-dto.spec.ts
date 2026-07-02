import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { SendMessageDto } from '@modules/messaging/dto/send-message.dto';

describe('SendMessageDto attachments', () => {
  it('accepts a well-formed attachment array', async () => {
    const dto = plainToInstance(SendMessageDto, {
      channel: 'email',
      body: 'oi',
      manualRecipients: [{ name: 'X', email: 'x@y.com' }],
      attachments: [{ path: 'message-attachments/u1/abc-file.pdf', filename: 'file.pdf', mimetype: 'application/pdf' }],
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects an attachment missing path', async () => {
    const dto = plainToInstance(SendMessageDto, {
      channel: 'email',
      body: 'oi',
      attachments: [{ filename: 'file.pdf', mimetype: 'application/pdf' }],
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
