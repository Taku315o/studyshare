import { fireEvent, render, screen } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import TimetableCell from './TimetableCell';
import type { TimetableOfferingItem } from '@/types/timetable';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

describe('TimetableCell', () => {
  const mockPush = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
  });

  it('renders offering information and navigates to offering detail on click', () => {
    const onOpenAdd = jest.fn();
    const onRequestRemove = jest.fn();
    const item: TimetableOfferingItem = {
      offeringId: 'offering-1',
      courseTitle: 'データベース概論',
      instructorName: '山田 太郎',
      startTime: '9:00',
      dayOfWeek: 1,
      period: 1,
      status: 'enrolled',
      colorToken: 'sky',
      createdAt: '2026-02-17T00:00:00.000Z',
    };

    render(
      <TimetableCell
        dayOfWeek={1}
        period={1}
        item={item}
        overlapCount={1}
        onOpenAdd={onOpenAdd}
        onRequestRemove={onRequestRemove}
      />,
    );

    expect(screen.getByText('データベース概論')).toBeInTheDocument();
    expect(screen.getByText('山田 太郎')).toBeInTheDocument();
    expect(screen.getByText('9:00')).toBeInTheDocument();
    expect(screen.getByText('履修中')).toBeInTheDocument();
    expect(screen.getByLabelText('お気に入り（準備中）')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /データベース概論/ }));
    expect(mockPush).toHaveBeenCalledWith('/offerings/offering-1');

    fireEvent.click(screen.getByRole('button', { name: '時間割から削除' }));
    expect(onRequestRemove).toHaveBeenCalledWith(item);
    expect(mockPush).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'このコマに授業を追加' }));
    expect(onOpenAdd).toHaveBeenCalledWith(1, 1);
  });

  it('shows restore action for dropped items', () => {
    const onRequestRestore = jest.fn();
    const item: TimetableOfferingItem = {
      offeringId: 'offering-2',
      courseTitle: '統計学',
      instructorName: '佐藤 花',
      startTime: '10:45',
      dayOfWeek: 2,
      period: 2,
      status: 'dropped',
      colorToken: 'amber',
      createdAt: '2026-02-17T00:00:00.000Z',
    };

    render(
      <TimetableCell
        dayOfWeek={2}
        period={2}
        item={item}
        overlapCount={1}
        onOpenAdd={jest.fn()}
        onRequestRestore={onRequestRestore}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '時間割へ再登録' }));
    expect(onRequestRestore).toHaveBeenCalledWith(item);
  });

  it('shows add lesson hint on hover and calls add handler when empty cell is clicked', () => {
    const onOpenAdd = jest.fn();

    render(
      <TimetableCell
        dayOfWeek={2}
        period={3}
        item={null}
        overlapCount={0}
        onOpenAdd={onOpenAdd}
      />,
    );

    const emptyButton = screen.getByRole('button', { name: '空きコマ' });
    fireEvent.mouseEnter(emptyButton);

    expect(screen.getByText('＋ 授業を追加')).toBeInTheDocument();

    fireEvent.click(emptyButton);
    expect(onOpenAdd).toHaveBeenCalledWith(2, 3);
  });

  it('supports dynamic period numbers', () => {
    const onOpenAdd = jest.fn();

    render(
      <TimetableCell
        dayOfWeek={5}
        period={8}
        item={null}
        overlapCount={0}
        onOpenAdd={onOpenAdd}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '空きコマ' }));
    expect(onOpenAdd).toHaveBeenCalledWith(5, 8);
  });
});
