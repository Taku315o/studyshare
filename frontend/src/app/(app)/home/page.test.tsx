import React from 'react';
import { render, screen } from '@testing-library/react';
import HomePage from './page';

describe('HomePage', () => {
  it('renders all primary dashboard sections', () => {
    render(<HomePage />);

    expect(screen.getByText('今週の時間割')).toBeInTheDocument();
    expect(screen.getByText('新着の口コミ')).toBeInTheDocument();
    expect(screen.getByText('最近見た授業')).toBeInTheDocument();
    expect(screen.getByText('ホットな掲示物')).toBeInTheDocument();
    expect(screen.getByText('人気の授業')).toBeInTheDocument();
    expect(screen.getByText('ミニ掲示板')).toBeInTheDocument();
  });
});
