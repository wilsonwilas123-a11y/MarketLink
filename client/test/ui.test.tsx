import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../src/components/ui/Button';
import { Chip } from '../src/components/ui/Chip';
import { Input } from '../src/components/ui/Input';
import { Avatar } from '../src/components/ui/Avatar';
import { Badge } from '../src/components/ui/Badge';

describe('Button', () => {
  it('is a real button that fires onClick', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Add to cart</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('cannot be clicked while loading', async () => {
    const onClick = vi.fn();
    render(<Button loading onClick={onClick}>Saving</Button>);
    const btn = screen.getByRole('button', { name: /saving/i });
    expect(btn).toBeDisabled();
    await userEvent.click(btn).catch(() => undefined);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('Chip', () => {
  it('exposes its selected state to assistive tech', () => {
    render(<Chip active>Vegetables</Chip>);
    expect(screen.getByRole('button', { name: 'Vegetables' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('Input', () => {
  it('associates the label and announces the error', () => {
    render(<Input label="Phone" error="Enter a valid phone number" />);
    const input = screen.getByLabelText('Phone');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Enter a valid phone number');
  });
});

describe('Avatar', () => {
  it('falls back to a person icon, never initials', () => {
    render(<Avatar />);
    const el = screen.getByRole('img', { name: /no photo/i });
    expect(el).toBeInTheDocument();
    expect(el.textContent).toBe('');
  });

  it('renders a photo when one is supplied', () => {
    const { container } = render(<Avatar src="https://example.test/ada.png" />);
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://example.test/ada.png');
  });
});

describe('Badge', () => {
  it('renders status text without swallowing it', () => {
    render(<Badge tone="accent">Open now</Badge>);
    expect(screen.getByText('Open now')).toBeInTheDocument();
  });
});
